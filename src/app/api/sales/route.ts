import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSalesForm } from '@/lib/validations/sales';
import { 
  SalesInputForm, 
  APIResponse, 
  ValidationError 
} from '@/types/database.types';

// POST: 売上データの作成
export async function POST(request: NextRequest) {
  try {
    // リクエストボディの取得
    const body: SalesInputForm = await request.json();

    // Supabase クライアント作成
    const supabase = createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: '認証が必要です',
      }, { status: 401 });
    }

    // バリデーション
    const validationErrors = validateSalesForm(body);
    if (validationErrors.length > 0) {
      return NextResponse.json<APIResponse<ValidationError[]>>({
        data: validationErrors,
        success: false,
        message: '入力データに不正があります',
      }, { status: 400 });
    }

    // 重複チェック（同じ日・店舗・部門・カテゴリの組み合わせ）
    const { data: existingData, error: checkError } = await supabase
      .from('sales')
      .select('id')
      .eq('date', body.date)
      .eq('store_id', body.store_id)
      .eq('department', body.department)
      .eq('product_category', body.product_category)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking duplicate:', checkError);
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: 'データベースエラーが発生しました',
      }, { status: 500 });
    }

    if (existingData) {
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: '同じ日付・店舗・部門・カテゴリの売上データが既に存在します',
      }, { status: 409 });
    }

    // 売上データの作成
    const salesData = {
      ...body,
      created_by: user.id,
      tax: Math.round(body.revenue_ex_tax * 0.1), // 10% の消費税を自動計算
    };

    const { data: newSales, error: insertError } = await supabase
      .from('sales')
      .insert([salesData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting sales data:', insertError);
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: '売上データの保存に失敗しました',
      }, { status: 500 });
    }

    // 監査ログの記録
    const auditLogData = {
      actor_id: user.id,
      action: 'input_sales',
      target: `sales:${newSales.id}`,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      ua: request.headers.get('user-agent') || 'unknown',
      meta: {
        sales_id: newSales.id,
        store_id: body.store_id,
        date: body.date,
        revenue_ex_tax: body.revenue_ex_tax,
        department: body.department,
        product_category: body.product_category,
      },
    };

    const { error: auditError } = await supabase
      .from('audit_log')
      .insert([auditLogData]);

    if (auditError) {
      console.error('Error inserting audit log:', auditError);
      // 監査ログエラーは処理を停止しない（警告ログのみ）
    }

    // 成功レスポンス
    return NextResponse.json<APIResponse<typeof newSales>>({
      data: newSales,
      success: true,
      message: '売上データを正常に保存しました',
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in sales API:', error);
    return NextResponse.json<APIResponse<null>>({
      data: null,
      success: false,
      message: 'サーバーエラーが発生しました',
    }, { status: 500 });
  }
}

// GET: 売上データの取得（フィルタ・ページング対応）
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: '認証が必要です',
      }, { status: 401 });
    }

    // クエリパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const department = searchParams.get('department');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // クエリビルダー
    let query = supabase
      .from('sales')
      .select(`
        *,
        dim_store:store_id (
          name,
          area
        )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    // フィルタ適用
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (department) {
      query = query.eq('department', department);
    }

    // ページング適用
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching sales data:', error);
      return NextResponse.json<APIResponse<null>>({
        data: null,
        success: false,
        message: '売上データの取得に失敗しました',
      }, { status: 500 });
    }

    // 監査ログの記録
    const auditLogData = {
      actor_id: user.id,
      action: 'view_dashboard',
      target: 'sales_list',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      ua: request.headers.get('user-agent') || 'unknown',
      meta: {
        filters: {
          store_id: storeId,
          start_date: startDate,
          end_date: endDate,
          department,
        },
        result_count: data?.length || 0,
      },
    };

    const { error: auditError } = await supabase
      .from('audit_log')
      .insert([auditLogData]);

    if (auditError) {
      console.error('Error inserting audit log:', auditError);
    }

    return NextResponse.json<APIResponse<typeof data>>({
      data,
      success: true,
      message: '売上データを取得しました',
      meta: {
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('Unexpected error in sales GET API:', error);
    return NextResponse.json<APIResponse<null>>({
      data: null,
      success: false,
      message: 'サーバーエラーが発生しました',
    }, { status: 500 });
  }
}
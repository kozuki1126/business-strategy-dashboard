import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { Database, SalesInputForm, AuditAction } from '@/types/database.types'

type SalesRecord = Database['public']['Tables']['sales']['Insert']
type AuditLog = Database['public']['Tables']['audit_log']['Insert']

// バリデーション関数
function validateSalesData(data: SalesInputForm): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // 必須フィールドチェック
  if (!data.date) errors.push('日付は必須です')
  if (!data.store_id) errors.push('店舗IDは必須です')
  if (!data.department) errors.push('部門は必須です')
  if (!data.product_category) errors.push('商品カテゴリは必須です')
  if (!data.revenue_ex_tax || data.revenue_ex_tax <= 0) {
    errors.push('税抜売上は1円以上で入力してください')
  }

  // 数値フィールドの妥当性チェック
  if (data.footfall !== undefined && data.footfall < 0) {
    errors.push('客数は0以上で入力してください')
  }
  if (data.transactions !== undefined && data.transactions < 0) {
    errors.push('取引数は0以上で入力してください')
  }
  if (data.discounts !== undefined && data.discounts < 0) {
    errors.push('割引額は0以上で入力してください')
  }

  // 日付形式チェック
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (data.date && !dateRegex.test(data.date)) {
    errors.push('日付の形式が正しくありません (YYYY-MM-DD)')
  }

  // 論理的な妥当性チェック
  if (data.footfall && data.transactions && data.transactions > data.footfall) {
    errors.push('取引数は客数以下で入力してください')
  }

  return { isValid: errors.length === 0, errors }
}

// 監査ログ記録関数
async function logAudit(
  supabase: any,
  userId: string,
  action: AuditAction,
  target: string,
  meta?: Record<string, any>,
  request?: NextRequest
) {
  const auditLog: AuditLog = {
    actor_id: userId,
    action,
    target,
    at: new Date().toISOString(),
    ip: request?.ip || request?.headers.get('x-forwarded-for') || null,
    ua: request?.headers.get('user-agent') || null,
    meta: meta || null
  }

  const { error } = await supabase
    .from('audit_log')
    .insert(auditLog)

  if (error) {
    console.error('監査ログ記録エラー:', error)
  }
}

// 税額計算（簡易版：10%）
function calculateTax(revenueExTax: number): number {
  return Math.round(revenueExTax * 0.1)
}

export async function POST(request: NextRequest) {
  let userId: string | null = null
  let requestData: SalesInputForm | null = null

  try {
    // 認証確認
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      )
    }
    userId = user.id

    // リクエストボディ解析
    try {
      requestData = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'リクエストデータの形式が正しくありません' },
        { status: 400 }
      )
    }

    // バリデーション
    const validation = validateSalesData(requestData)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'バリデーションエラー',
          errors: validation.errors 
        },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 店舗存在確認
    const { data: storeData, error: storeError } = await supabase
      .from('dim_store')
      .select('id, name')
      .eq('id', requestData.store_id)
      .single()

    if (storeError || !storeData) {
      return NextResponse.json(
        { success: false, message: '指定された店舗が見つかりません' },
        { status: 400 }
      )
    }

    // 重複チェック（同じ日付・店舗・部門・カテゴリの組み合わせ）
    const { data: existingData, error: duplicateError } = await supabase
      .from('sales')
      .select('id')
      .eq('date', requestData.date)
      .eq('store_id', requestData.store_id)
      .eq('department', requestData.department)
      .eq('product_category', requestData.product_category)
      .maybeSingle()

    if (duplicateError) {
      console.error('重複チェックエラー:', duplicateError)
      return NextResponse.json(
        { success: false, message: 'データベースエラーが発生しました' },
        { status: 500 }
      )
    }

    if (existingData) {
      return NextResponse.json(
        { 
          success: false, 
          message: '同じ日付・店舗・部門・カテゴリの売上データが既に存在します' 
        },
        { status: 409 }
      )
    }

    // 売上データ作成
    const tax = calculateTax(requestData.revenue_ex_tax)
    const salesData: SalesRecord = {
      date: requestData.date,
      store_id: requestData.store_id,
      department: requestData.department,
      product_category: requestData.product_category,
      revenue_ex_tax: requestData.revenue_ex_tax,
      footfall: requestData.footfall || null,
      transactions: requestData.transactions || null,
      discounts: requestData.discounts || null,
      tax: tax,
      notes: requestData.notes || null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // データベースに保存
    const { data: savedSales, error: salesError } = await supabase
      .from('sales')
      .insert(salesData)
      .select()
      .single()

    if (salesError) {
      console.error('売上データ保存エラー:', salesError)
      
      // 監査ログ記録（失敗）
      await logAudit(
        supabase,
        userId,
        'input_sales',
        `sales:${requestData.store_id}:${requestData.date}`,
        { 
          error: salesError.message,
          attempted_data: requestData
        },
        request
      )

      return NextResponse.json(
        { success: false, message: '売上データの保存に失敗しました' },
        { status: 500 }
      )
    }

    // 監査ログ記録（成功）
    await logAudit(
      supabase,
      userId,
      'input_sales',
      `sales:${savedSales.id}`,
      {
        store_id: requestData.store_id,
        store_name: storeData.name,
        date: requestData.date,
        department: requestData.department,
        product_category: requestData.product_category,
        revenue_ex_tax: requestData.revenue_ex_tax,
        calculated_tax: tax
      },
      request
    )

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      message: '売上データを保存しました',
      data: {
        id: savedSales.id,
        date: savedSales.date,
        store_name: storeData.name,
        revenue_ex_tax: savedSales.revenue_ex_tax,
        tax: savedSales.tax,
        total_revenue: savedSales.revenue_ex_tax + (savedSales.tax || 0)
      }
    })

  } catch (error) {
    console.error('API エラー:', error)

    // 監査ログ記録（システムエラー）
    if (userId && requestData) {
      try {
        const supabase = createClient()
        await logAudit(
          supabase,
          userId,
          'input_sales',
          `sales:error`,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            attempted_data: requestData
          },
          request
        )
      } catch (auditError) {
        console.error('監査ログ記録エラー:', auditError)
      }
    }

    return NextResponse.json(
      { success: false, message: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// GET メソッド：売上データ取得（将来の拡張用）
export async function GET(request: NextRequest) {
  try {
    // 認証確認
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const date = searchParams.get('date')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createClient()
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
      .limit(limit)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (date) {
      query = query.eq('date', date)
    }

    const { data, error } = await query

    if (error) {
      console.error('売上データ取得エラー:', error)
      return NextResponse.json(
        { success: false, message: 'データの取得に失敗しました' },
        { status: 500 }
      )
    }

    // 監査ログ記録
    await logAudit(
      supabase,
      user.id,
      'view_dashboard',
      'sales:list',
      {
        filters: { store_id: storeId, date: date },
        result_count: data?.length || 0
      },
      request
    )

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total: data?.length || 0,
        limit: limit
      }
    })

  } catch (error) {
    console.error('API エラー:', error)
    return NextResponse.json(
      { success: false, message: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

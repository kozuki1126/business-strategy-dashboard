import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { salesInputSchema, salesEditSchema, bulkSalesInputSchema } from '@/lib/validations/sales'
import { z } from 'zod'

// Get sales records with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const storeId = searchParams.get('store_id')
    const departmentId = searchParams.get('department_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sortBy = searchParams.get('sort_by') || 'date'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('sales')
      .select(`
        id,
        date,
        revenue_ex_tax,
        tax_amount,
        footfall,
        transactions,
        notes,
        created_at,
        updated_at,
        dim_store:store_id(id, name, code, area),
        dim_department:department_id(id, name, category)
      `)

    // Apply filters
    if (storeId) {
      query = query.eq('store_id', storeId)
    }
    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    // Apply sorting
    const validSortFields = ['date', 'revenue_ex_tax', 'footfall', 'transactions', 'created_at']
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Calculate metrics for each record
    const salesWithMetrics = (data || []).map(record => {
      const revenue = record.revenue_ex_tax || 0
      const tax = record.tax_amount || 0
      const transactions = record.transactions || 0
      const footfall = record.footfall || 0

      return {
        ...record,
        calculated_metrics: {
          total_revenue: revenue + tax,
          tax_rate: revenue > 0 ? (tax / revenue) * 100 : 0,
          average_order_value: transactions > 0 ? revenue / transactions : 0,
          conversion_rate: footfall > 0 ? (transactions / footfall) * 100 : 0
        }
      }
    })

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      data: salesWithMetrics,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNext: page * limit < (totalCount || 0),
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Sales GET error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Create new sales record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = salesInputSchema.parse(body)
    
    // Calculate additional metrics
    const revenue = validatedData.revenue_ex_tax
    const tax = validatedData.tax_amount
    const transactions = validatedData.transactions
    
    // Insert into database
    const { data, error } = await supabase
      .from('sales')
      .insert({
        date: validatedData.date,
        store_id: validatedData.store_id,
        department_id: validatedData.department_id,
        revenue_ex_tax: validatedData.revenue_ex_tax,
        tax_amount: validatedData.tax_amount,
        footfall: validatedData.footfall,
        transactions: validatedData.transactions,
        notes: validatedData.notes || null
      })
      .select(`
        id,
        date,
        revenue_ex_tax,
        tax_amount,
        footfall,
        transactions,
        notes,
        created_at,
        dim_store:store_id(id, name, code),
        dim_department:department_id(id, name, category)
      `)
      .single()

    if (error) {
      // Handle duplicate entries
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'この日付・店舗・部門の組み合わせは既に登録されています' },
          { status: 409 }
        )
      }
      throw error
    }

    // Add calculated metrics to response
    const responseData = {
      ...data,
      calculated_metrics: {
        total_revenue: revenue + tax,
        tax_rate: revenue > 0 ? (tax / revenue) * 100 : 0,
        average_order_value: transactions > 0 ? revenue / transactions : 0,
        conversion_rate: validatedData.footfall > 0 ? (transactions / validatedData.footfall) * 100 : 0
      }
    }

    return NextResponse.json(responseData, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Sales POST error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create sales record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Update existing sales record
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = salesEditSchema.parse(body)
    
    // Check if record exists
    const { data: existingRecord, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', validatedData.id)
      .single()

    if (fetchError || !existingRecord) {
      return NextResponse.json(
        { error: 'Sales record not found' },
        { status: 404 }
      )
    }

    // Update record
    const { data, error } = await supabase
      .from('sales')
      .update({
        date: validatedData.date,
        store_id: validatedData.store_id,
        department_id: validatedData.department_id,
        revenue_ex_tax: validatedData.revenue_ex_tax,
        tax_amount: validatedData.tax_amount,
        footfall: validatedData.footfall,
        transactions: validatedData.transactions,
        notes: validatedData.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedData.id)
      .select(`
        id,
        date,
        revenue_ex_tax,
        tax_amount,
        footfall,
        transactions,
        notes,
        created_at,
        updated_at,
        dim_store:store_id(id, name, code),
        dim_department:department_id(id, name, category)
      `)
      .single()

    if (error) throw error

    // Log edit to audit_log
    await supabase.from('audit_log').insert({
      actor_email: 'system', // TODO: Get from authenticated user
      action: 'update',
      target_type: 'sales',
      target_id: validatedData.id,
      metadata: {
        edit_reason: validatedData.edit_reason,
        original_values: existingRecord,
        new_values: validatedData
      }
    })

    // Add calculated metrics
    const revenue = data.revenue_ex_tax
    const tax = data.tax_amount
    const transactions = data.transactions
    const footfall = data.footfall

    const responseData = {
      ...data,
      calculated_metrics: {
        total_revenue: revenue + tax,
        tax_rate: revenue > 0 ? (tax / revenue) * 100 : 0,
        average_order_value: transactions > 0 ? revenue / transactions : 0,
        conversion_rate: footfall > 0 ? (transactions / footfall) * 100 : 0
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Sales PUT error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update sales record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Delete sales record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const reason = searchParams.get('reason')

    if (!id) {
      return NextResponse.json(
        { error: 'Sales record ID is required' },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Deletion reason is required' },
        { status: 400 }
      )
    }

    // Get record before deletion for audit log
    const { data: existingRecord, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRecord) {
      return NextResponse.json(
        { error: 'Sales record not found' },
        { status: 404 }
      )
    }

    // Delete record
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Log deletion to audit_log
    await supabase.from('audit_log').insert({
      actor_email: 'system', // TODO: Get from authenticated user
      action: 'delete',
      target_type: 'sales',
      target_id: id,
      metadata: {
        deletion_reason: reason,
        deleted_record: existingRecord
      }
    })

    return NextResponse.json({ message: 'Sales record deleted successfully' })

  } catch (error) {
    console.error('Sales DELETE error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete sales record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

import { supabase } from '../supabase'
import type { PrintJob, PrintJobStatus } from '../../types'

export const printJobsService = {
  async getAll(filters?: { status?: PrintJobStatus }): Promise<PrintJob[]> {
    let query = supabase.from('print_jobs').select('*')
    if (filters?.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      orderId: row.order_id as string,
      status: row.status as PrintJobStatus,
      configData: (row.config_data as Record<string, string | number | boolean>) || {},
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }))
  },

  async getById(id: string): Promise<PrintJob> {
    const { data, error } = await supabase.from('print_jobs').select('*').eq('id', id).single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async enqueue(input: { shopId: string; orderId: string; configData: Record<string, string | number | boolean> }): Promise<PrintJob> {
    const { data, error } = await supabase.from('print_jobs').insert({
      shop_id: input.shopId,
      order_id: input.orderId,
      status: 'pending',
      config_data: input.configData,
    }).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async updateStatus(id: string, status: PrintJobStatus): Promise<PrintJob> {
    const updateData: Record<string, unknown> = { status }
    if (status === 'completed' || status === 'failed') updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabase.from('print_jobs').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('print_jobs').delete().eq('id', id)
    if (error) throw error
  },
}

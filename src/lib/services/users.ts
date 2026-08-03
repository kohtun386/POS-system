import { supabase } from '../supabase'
import type { User } from '../../types'

export const usersService = {
  async getAll(shopId?: string): Promise<User[]> {
    let query = supabase
      .from('users')
      .select('*')
      .order('name')

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(user => ({
      id: user.id,
      shopId: user.shop_id || undefined,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role as User['role'],
      permissions: user.permissions || [],
      active: user.active ?? true,
      lastLogin: user.last_login ? new Date(user.last_login) : undefined,
      avatar: user.avatar || undefined
    }))
  },

  async update(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        avatar: user.avatar,
        last_login: user.lastLogin?.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id || undefined,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role as User['role'],
      permissions: data.permissions || [],
      active: data.active ?? true,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      avatar: data.avatar || undefined
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

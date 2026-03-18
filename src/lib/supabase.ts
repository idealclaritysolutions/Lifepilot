import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xttswnxtvlpvcoryuapd.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dHN3bnh0dmxwdmNvcnl1YXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTM5MTMsImV4cCI6MjA4NzkyOTkxM30.TObRT1g2kRpEDlmR9tAjbr7s0myUgbNS6dN2vo_nmGM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── TYPES ───────────────────────────────────────────────────────

export interface SharedItem {
  id?: string
  household_id: string
  text: string
  category: string
  checked: boolean
  added_by: string
  notes?: string
  link?: string
  created_at?: string
}

export interface HouseholdInfo {
  id: string
  name: string
  shareCode: string
  memberCount: number
  role: string
}

export interface HouseholdMember {
  id?: string
  household_id: string
  clerk_user_id: string
  user_id: string
  role: 'owner' | 'member'
  display_name?: string
  joined_at?: string
}

export interface ActivityEntry {
  id?: string
  household_id: string
  user_id: string
  action: string
  details?: any
  created_at?: string
}

// ─── USER DATA SYNC ──────────────────────────────────────────────

export async function saveUserData(userId: string, data: any): Promise<boolean> {
  try {
    console.log('[Supabase] Saving data for:', userId)
    const { error } = await supabase
      .from('user_data')
      .upsert({ 
        clerk_user_id: userId,
        user_id: userId, 
        app_state: data, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'clerk_user_id' })
    if (error) {
      console.error('[Supabase] Save error (clerk_user_id):', error.message)
      const { error: err2 } = await supabase
        .from('user_data')
        .upsert({ 
          clerk_user_id: userId,
          user_id: userId, 
          app_state: data, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' })
      if (err2) { console.error('[Supabase] Save error (user_id):', err2.message); return false }
    }
    return true
  } catch (err: any) { console.error('[Supabase] Save exception:', err?.message); return false }
}

export async function loadUserData(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('user_data').select('app_state')
      .or(`user_id.eq.${userId},clerk_user_id.eq.${userId}`)
      .limit(1)
      .single()
    if (error || !data) {
      console.log('[Supabase] No cloud data found for:', userId)
      return null
    }
    console.log('[Supabase] Cloud data loaded for:', userId)
    return data.app_state
  } catch { return null }
}

export async function deleteUserData(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_data').delete().eq('user_id', userId)
    return !error
  } catch { return false }
}

// ─── HOUSEHOLD / FAMILY SHARING ──────────────────────────────────

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createHousehold(userId: string, name: string): Promise<{ id: string; shareCode: string } | null> {
  try {
    const shareCode = generateShareCode()
    const { data, error } = await supabase
      .from('households')
      .insert({ name, share_code: shareCode, owner_clerk_id: userId, owner_user_id: userId })
      .select('id, share_code')
      .single()
    if (error || !data) { console.error('[Supabase] Create household error:', error?.message); return null }
    const { error: memberErr } = await supabase.from('household_members').insert({ household_id: data.id, clerk_user_id: userId, user_id: userId, role: 'owner' })
    if (memberErr) console.error('[Supabase] Add member error:', memberErr.message)
    return { id: data.id, shareCode: data.share_code }
  } catch (e: any) { console.error('[Supabase] Create household exception:', e.message); return null }
}

export async function joinHousehold(userId: string, shareCode: string): Promise<{ id: string; name: string } | null> {
  try {
    const { data: household, error } = await supabase
      .from('households').select('id, name').eq('share_code', shareCode.toUpperCase().trim()).single()
    if (error || !household) return null
    const { data: existing } = await supabase
      .from('household_members').select('id')
      .eq('household_id', household.id)
      .or(`user_id.eq.${userId},clerk_user_id.eq.${userId}`)
      .single()
    if (!existing) {
      await supabase.from('household_members').insert({ household_id: household.id, clerk_user_id: userId, user_id: userId, role: 'member' })
    }
    return { id: household.id, name: household.name }
  } catch { return null }
}

export async function getMyHouseholds(userId: string): Promise<HouseholdInfo[]> {
  try {
    const { data: memberships } = await supabase
      .from('household_members').select('household_id, role')
      .or(`user_id.eq.${userId},clerk_user_id.eq.${userId}`)
    if (!memberships || memberships.length === 0) return []

    const results: HouseholdInfo[] = []
    for (const m of memberships) {
      const { data: hh } = await supabase
        .from('households').select('id, name, share_code').eq('id', m.household_id).single()
      if (!hh) continue
      const { count } = await supabase
        .from('household_members').select('id', { count: 'exact', head: true }).eq('household_id', hh.id)
      results.push({ id: hh.id, name: hh.name, shareCode: hh.share_code, memberCount: count || 1, role: m.role })
    }
    return results
  } catch { return [] }
}

export async function leaveHousehold(userId: string, householdId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('household_members').delete()
      .eq('household_id', householdId)
      .or(`user_id.eq.${userId},clerk_user_id.eq.${userId}`)
    return !error
  } catch { return false }
}

export async function renameHousehold(householdId: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('households')
      .update({ name: newName })
      .eq('id', householdId)
    return !error
  } catch {
    return false
  }
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  try {
    const { data } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
    return data || []
  } catch {
    return []
  }
}

// ─── SHARED ITEMS ────────────────────────────────────────────────

export async function getSharedItems(householdId: string): Promise<SharedItem[]> {
  try {
    const { data } = await supabase.from('shared_items').select('*').eq('household_id', householdId).order('created_at', { ascending: false })
    return data || []
  } catch { return [] }
}

export async function addSharedItem(item: Omit<SharedItem, 'id' | 'created_at'>): Promise<SharedItem | null> {
  try {
    const { data, error } = await supabase.from('shared_items').insert(item).select().single()
    if (error) return null
    return data
  } catch { return null }
}

export async function toggleSharedItem(id: string, checked: boolean): Promise<boolean> {
  try {
    const { error } = await supabase.from('shared_items').update({ checked }).eq('id', id)
    return !error
  } catch { return false }
}

export async function updateSharedItemNotes(id: string, notes: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('shared_items').update({ notes }).eq('id', id)
    return !error
  } catch { return false }
}

export async function updateSharedItemText(id: string, text: string, link?: string): Promise<boolean> {
  try {
    const updates: any = { text }
    if (link !== undefined) updates.link = link
    const { error } = await supabase.from('shared_items').update(updates).eq('id', id)
    return !error
  } catch { return false }
}

export async function removeSharedItem(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('shared_items').delete().eq('id', id)
    return !error
  } catch { return false }
}

export function subscribeToSharedItems(householdId: string, callback: (items: SharedItem[]) => void) {
  const channel = supabase
    .channel('shared-items-' + householdId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_items', filter: `household_id=eq.${householdId}` },
      () => { getSharedItems(householdId).then(callback) }
    ).subscribe()
  return () => { supabase.removeChannel(channel) }
}

// ─── ACTIVITY LOG & USER DISPLAY ─────────────────────────────────

export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('household_members')
      .select('display_name')
      .or(`user_id.eq.${userId},clerk_user_id.eq.${userId}`)
      .single()
    return data?.display_name || 'User'
  } catch {
    return 'User'
  }
}

export async function logActivity(householdId: string, userId: string, action: string, details?: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        household_id: householdId,
        user_id: userId,
        action,
        details,
        created_at: new Date().toISOString()
      })
    return !error
  } catch {
    return false
  }
}

export async function getActivityLog(householdId: string, limit: number = 50): Promise<ActivityEntry[]> {
  try {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  } catch {
    return []
  }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import {
  getMyHouseholds, createHousehold, joinHousehold, leaveHousehold,
  getSharedItems, addSharedItem, toggleSharedItem, removeSharedItem, updateSharedItemNotes, updateSharedItemText, updateSharedItemCategory,
  subscribeToSharedItems, getUserDisplayName, logActivity, getActivityLog, renameHousehold, getHouseholdMembers,
  type SharedItem, type HouseholdInfo, type ActivityEntry, type HouseholdMember
} from '@/lib/supabase'
import { ArrowLeft, Plus, Users, Copy, Check, Trash2, ShoppingCart, LogOut, Loader2, ChevronRight, StickyNote, Link as LinkIcon, Pencil, History, Clock, Crown, MoreHorizontal, Search, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AppState } from '@/App'

interface Props {
  onClose: () => void
  state: any
  isTab?: boolean
}

function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim())
}

// ─── Interim metadata + quantity conventions (NO migration possible:
// the shared_items table has only id, household_id, text, category,
// checked, added_by, notes, link, created_at). ─────────────────────
//
// META: date/time/location are packed into `notes` as
//   "📅 DATE · 🕐 TIME · 📍 LOCATION · <free-text note>"
// parseMeta() splits the segments back out; packMeta() rebuilds.
// Rule: note edits preserve the meta segments, detail edits preserve
// the note. Display renders the segments as separate chips, never as
// part of the note text.
//
// QTY: a trailing " ×N" suffix on `text`, e.g. "Milk ×2".
// parseQty() splits base text from quantity; withQty() re-applies
// (N<=1 removes the suffix). The edit input shows the base text only.
export interface ParsedMeta { date: string; time: string; location: string; note: string }
export function parseMeta(notes?: string): ParsedMeta {
  const out: ParsedMeta = { date: '', time: '', location: '', note: '' }
  if (!notes) return out
  const noteParts: string[] = []
  for (const seg of notes.split(' · ')) {
    if (seg.startsWith('📅 ')) out.date = seg.slice(2).trim()
    else if (seg.startsWith('🕐 ')) out.time = seg.slice(2).trim()
    else if (seg.startsWith('📍 ')) out.location = seg.slice(2).trim()
    else noteParts.push(seg)
  }
  out.note = noteParts.join(' · ')
  return out
}
export function packMeta(m: ParsedMeta): string {
  const parts: string[] = []
  if (m.date) parts.push(`📅 ${m.date}`)
  if (m.time) parts.push(`🕐 ${m.time}`)
  if (m.location) parts.push(`📍 ${m.location}`)
  if (m.note.trim()) parts.push(m.note.trim())
  return parts.join(' · ')
}
export function parseQty(text: string): { base: string; qty: number } {
  const m = text.match(/^(.*) ×(\d+)$/)
  if (!m) return { base: text, qty: 1 }
  const qty = parseInt(m[2], 10)
  return { base: m[1], qty: qty > 0 ? qty : 1 }
}
export function withQty(base: string, qty: number): string {
  return qty > 1 ? `${base} ×${qty}` : base
}

// Grocery categories stored in the existing `category` column.
// Anything not in this list (e.g. legacy 'grocery') groups under General.
export const LIST_CATEGORIES = ['Produce', 'Dairy', 'Bakery', 'Meat & Seafood', 'Pantry', 'Frozen', 'Beverages', 'Household', 'General']
export function groupOf(item: SharedItem): string {
  return LIST_CATEGORIES.includes(item.category) ? item.category : 'General'
}

export function SharedListView({ onClose, state, isTab }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [households, setHouseholds] = useState<HouseholdInfo[]>([])
  const [activeHH, setActiveHH] = useState<HouseholdInfo | null>(null)
  const [items, setItems] = useState<SharedItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [newItemDate, setNewItemDate] = useState('')
  const [newItemTime, setNewItemTime] = useState('')
  const [newItemLocation, setNewItemLocation] = useState('')
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [itemMenu, setItemMenu] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('General')
  const [editingDetails, setEditingDetails] = useState<string | null>(null)
  const [detDate, setDetDate] = useState('')
  const [detTime, setDetTime] = useState('')
  const [detLocation, setDetLocation] = useState('')
  const [detCategory, setDetCategory] = useState('General')
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [showLog, setShowLog] = useState(false)
  const [renamingList, setRenamingList] = useState(false)
  const [renameText, setRenameText] = useState('')
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const isPremium = state.subscription.tier === 'premium' || state.subscription.tier === 'enterprise'

  const loadHouseholds = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const hhs = await getMyHouseholds(user.id)
    setHouseholds(hhs)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadHouseholds().then(() => {
      // Restore last active list on refresh
      const savedId = sessionStorage.getItem('lp-active-list')
      if (savedId) {
        getMyHouseholds(user?.id || '').then(hhs => {
          const saved = hhs.find(h => h.id === savedId)
          if (saved) openHousehold(saved)
        })
      }
    })
  }, [loadHouseholds])

  const openHousehold = async (hh: HouseholdInfo) => {
    setActiveHH(hh)
    sessionStorage.setItem('lp-active-list', hh.id)
    const sharedItems = await getSharedItems(hh.id)
    setItems(sharedItems)
    // Load members
    const memberList = await getHouseholdMembers(hh.id)
    setMembers(memberList)
    // Resolve names for all item authors
    const userIds = [...new Set(sharedItems.map(i => i.added_by).filter(Boolean))]
    const names: Record<string, string> = { ...nameMap }
    for (const m of memberList) { if (m.name) names[m.user_id] = m.name }
    for (const uid of userIds) {
      if (!names[uid]) names[uid] = await getUserDisplayName(uid)
    }
    setNameMap(names)
  }

  useEffect(() => {
    if (!activeHH?.id) return
    const unsub = subscribeToSharedItems(activeHH.id, setItems)
    return unsub
  }, [activeHH?.id])

  const handleCreate = async () => {
    if (!user?.id || !householdName.trim()) return
    const result = await createHousehold(user.id, householdName.trim())
    if (result) {
      toast.success('List created! Share the code with others.')
      setHouseholdName('')
      setShowCreate(false)
      loadHouseholds()
    } else {
      toast.error('Failed to create list')
    }
  }

  const handleJoin = async () => {
    if (!user?.id || !joinCode.trim()) return
    const result = await joinHousehold(user.id, joinCode.trim())
    if (result) {
      toast.success(`Joined "${result.name}"!`)
      setJoinCode('')
      loadHouseholds()
    } else {
      toast.error('Invalid code. Check and try again.')
    }
  }

  const handleAddItem = async () => {
    if (!activeHH?.id || !user?.id || !newItem.trim()) return
    // Details pack into notes via the shared convention (see parseMeta/packMeta);
    // the free-text note stays the note, meta segments stay segments.
    const fullNotes = packMeta({ date: newItemDate, time: newItemTime, location: newItemLocation, note: newItemNote.trim() }) || undefined

    await addSharedItem({
      household_id: activeHH.id,
      text: newItem.trim(),
      category: newItemCategory,
      checked: false,
      added_by: user.id,
      notes: fullNotes,
    })
    await logActivity(activeHH.id, user.id, 'added', newItem.trim())
    setNewItem('')
    setNewItemNote('')
    setNewItemDate('')
    setNewItemTime('')
    setNewItemLocation('')
    setNewItemCategory('General')
    setShowItemDetails(false)
    const updated = await getSharedItems(activeHH.id)
    setItems(updated)
  }

  const handleToggle = async (id: string, checked: boolean) => {
    const item = items.find(i => i.id === id)
    await toggleSharedItem(id, !checked)
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i))
    if (activeHH?.id && user?.id && item) {
      await logActivity(activeHH.id, user.id, checked ? 'unchecked' : 'checked off', item.text)
    }
  }

  const handleRemove = async (id: string) => {
    const item = items.find(i => i.id === id)
    // Confirm only for unchecked items; deleting an already-checked
    // item is instant (it's done — no need to ask twice).
    if (item && !item.checked && !confirm('Remove this item?')) return
    await removeSharedItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (activeHH?.id && user?.id && item) {
      await logActivity(activeHH.id, user.id, 'removed', item.text)
    }
  }

  const handleSaveNote = async (id: string) => {
    // Note edits preserve the packed date/time/location segments.
    const item = items.find(i => i.id === id)
    const meta = parseMeta(item?.notes)
    const packed = packMeta({ ...meta, note: noteText })
    await updateSharedItemNotes(id, packed)
    setItems(prev => prev.map(i => i.id === id ? { ...i, notes: packed } : i))
    setEditingNote(null)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return
    // The edit input shows the base text only; re-apply the quantity
    // suffix on save so editing never drops it.
    const item = items.find(i => i.id === id)
    const qty = item ? parseQty(item.text).qty : 1
    const nextText = withQty(editText.trim(), qty)
    await updateSharedItemText(id, nextText)
    setItems(prev => prev.map(i => i.id === id ? { ...i, text: nextText } : i))
    setEditingItem(null)
  }

  const changeQty = async (item: SharedItem, delta: number) => {
    if (!item.id) return
    const { base, qty } = parseQty(item.text)
    const nextQty = qty + delta
    if (nextQty < 1) return
    const nextText = withQty(base, nextQty)
    await updateSharedItemText(item.id, nextText)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, text: nextText } : i))
  }

  const handleSaveDetails = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    // Detail edits preserve the free-text note; category saves separately.
    const meta = parseMeta(item.notes)
    const packed = packMeta({ date: detDate, time: detTime, location: detLocation, note: meta.note })
    await updateSharedItemNotes(id, packed)
    await updateSharedItemCategory(id, detCategory)
    setItems(prev => prev.map(i => i.id === id ? { ...i, notes: packed, category: detCategory } : i))
    setEditingDetails(null)
  }

  const handleClearCompleted = async () => {
    if (!activeHH?.id || !user?.id) return
    const checked = items.filter(i => i.checked)
    if (checked.length === 0) { toast('No completed items to clear'); return }
    if (!confirm(`Remove ${checked.length} completed item${checked.length > 1 ? 's' : ''}?`)) return
    checked.forEach(i => { removeSharedItem(i.id!); logActivity(activeHH.id, user.id, 'cleared completed', i.text) })
    setItems(prev => prev.filter(i => !i.checked))
    toast.success(`${checked.length} completed items cleared`)
  }

  const handleLeave = async (hhId: string) => {
    if (!user?.id) return
    if (!confirm('Leave this list? You can rejoin with the share code later.')) return
    await leaveHousehold(user.id, hhId)
    if (activeHH?.id === hhId) { setActiveHH(null); setItems([]); sessionStorage.removeItem("lp-active-list") }
    loadHouseholds()
    toast.success('Left list')
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Not signed in OR not on the right plan
  if (!user || !isPremium) {
    return (
      <div className={`${isTab ? '' : 'min-h-[100dvh]'} max-w-lg mx-auto bg-[#FAF9F6]`}>
        {!isTab && (
          <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
            <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-stone-700" />
            </button>
            <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Shared Lists</h1>
          </header>
        )}
        <div className="p-5 space-y-5">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              Your life is better shared
            </h2>
            <p className="text-base text-stone-600 max-w-xs mx-auto leading-relaxed">
              The people who matter most to you deserve a seamless way to stay connected and organized — together.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-stone-800 text-base">What you unlock with Shared Lists:</h3>
            {[
              { icon: '🛒', title: 'Real-time shared shopping lists', desc: 'Add items from anywhere — your family sees them instantly. No more duplicate purchases or forgotten items.' },
              { icon: '🎉', title: 'Event & trip planning', desc: 'Coordinate birthdays, vacations, and gatherings with everyone on the same page.' },
              { icon: '🤖', title: 'AI-powered list building', desc: 'Ask Life Pilot AI to find products, compare prices, and add them with links — straight to your shared list.' },
              { icon: '📝', title: 'Notes on every item', desc: 'Add context like "the organic one" or "size medium" so nothing gets lost in translation.' },
              { icon: '🔗', title: 'Links on items', desc: 'Add a real link to any item and tap it to open it — or ask Life Pilot AI to add items with links for you.' },
              { icon: '👥', title: 'Unlimited lists, unlimited members', desc: 'Family groceries, friend group trips, roommate chores — create as many lists as your life needs.' },
            ].map(f => (
              <div key={f.title} className="flex gap-3">
                <span className="text-xl flex-none mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{f.title}</p>
                  <p className="text-sm text-stone-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-center">
            <p className="text-base font-semibold text-amber-900 mb-1">Available on Inner Circle & Guided plans</p>
            <p className="text-sm text-amber-800 mb-3">
              {!user 
                ? 'Create a free account first, then upgrade to unlock Shared Lists and all premium features.'
                : 'Upgrade your plan to unlock Shared Lists and all premium features.'}
            </p>
            <p className="text-xs text-amber-700">Tap the 👑 icon in the top menu to view plans</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] max-w-lg mx-auto flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    )
  }

  // ACTIVE LIST VIEW
  if (activeHH) {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = (i: SharedItem) => !q || i.text.toLowerCase().includes(q) || parseMeta(i.notes).note.toLowerCase().includes(q)
    const unchecked = items.filter(i => !i.checked && matchesSearch(i))
    const checked = items.filter(i => i.checked && matchesSearch(i))
    const groups = LIST_CATEGORIES.map(name => ({ name, items: unchecked.filter(i => groupOf(i) === name) })).filter(g => g.items.length > 0)

    return (
      <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <button onClick={() => { setActiveHH(null); setItems([]); sessionStorage.removeItem("lp-active-list") }} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-stone-900" style={{ fontFamily: "'Georgia', serif" }}>{activeHH.name}</h1>
            <p className="text-xs text-stone-500">{activeHH.memberCount} member{activeHH.memberCount > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-xs font-medium text-stone-700">
            <Share2 className="w-3 h-3" /> Share
          </button>
        </header>

        <div className="p-4 space-y-3">
          {/* Add item — fast-add first: one input + Add. Details
              (date, time, location, note, category) live behind the
              toggle only, so adding "milk" in a store is one tap. */}
          <div className="bg-white rounded-2xl border border-stone-100 p-3 shadow-sm space-y-2">
            <div className="flex gap-2">
              <input value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddItem()}
                placeholder="Add to list..."
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
              <button onClick={handleAddItem} disabled={!newItem.trim()}
                className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => setShowItemDetails(!showItemDetails)}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium px-1">
              {showItemDetails ? '− Hide details' : '+ Add date, time, location, note, category'}
            </button>
            {showItemDetails && (
              <div className="grid grid-cols-2 gap-2">
                <input value={newItemDate} onChange={e => setNewItemDate(e.target.value)} type="date"
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50" />
                <input value={newItemTime} onChange={e => setNewItemTime(e.target.value)} type="time"
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50" />
                <input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)}
                  placeholder="📍 Location (optional)"
                  className="col-span-2 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 bg-stone-50" />
                <input value={newItemNote} onChange={e => setNewItemNote(e.target.value)}
                  placeholder="📝 Note (optional)"
                  className="col-span-2 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 bg-stone-50" />
                <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50">
                  {LIST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Search — filters unchecked + checked by text and note. */}
          {items.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-stone-200 bg-white">
              <Search className="w-4 h-4 text-stone-400 flex-none" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search this list…"
                className="flex-1 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none bg-transparent" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-xs text-stone-400 hover:text-stone-600 flex-none">Clear</button>
              )}
            </div>
          )}

          {/* Items */}
          {unchecked.length === 0 && checked.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-base text-stone-600 font-medium">{searchQuery ? 'No matches' : 'Your list is empty'}</p>
              <p className="text-sm text-stone-500 mt-1">{searchQuery ? 'Try a different search' : 'Add items above — they\'ll appear for everyone'}</p>
            </div>
          ) : (
            <>
              {groups.map(group => (
                <div key={group.name}>
                  <p className="text-[14px] font-semibold text-stone-900 mt-5 mb-1 first:mt-0">{group.name}</p>
                  <div className="divide-y divide-stone-200/70">
                    {group.items.map(item => {
                      const hasLink = !!item.link && isUrl(item.link)
                      const meta = parseMeta(item.notes)
                      const { base, qty } = parseQty(item.text)
                      return (
                      <div key={item.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <button onClick={() => handleToggle(item.id!, item.checked)}
                            className="w-7 h-7 rounded-full border-2 border-stone-300 flex-none hover:border-emerald-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            {editingItem === item.id ? (
                              <div className="flex gap-2">
                                <input value={editText} onChange={e => setEditText(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit(item.id!)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-800" autoFocus />
                                <button onClick={() => handleSaveEdit(item.id!)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                                <button onClick={() => setEditingItem(null)} className="px-2 py-1.5 rounded-lg text-xs text-stone-500">✕</button>
                              </div>
                            ) : (
                              <>
                                <p className="text-base text-stone-900 font-medium leading-snug">
                                  {base}
                                  {qty > 1 && (
                                    <span className="ml-2 text-xs font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md align-middle">×{qty}</span>
                                  )}
                                </p>
                                {(meta.date || meta.time || meta.location) && (
                                  <span className="flex flex-wrap gap-1 mt-1">
                                    {meta.date && <span className="text-xs text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">📅 {meta.date}</span>}
                                    {meta.time && <span className="text-xs text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">🕐 {meta.time}</span>}
                                    {meta.location && <span className="text-xs text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">📍 {meta.location}</span>}
                                  </span>
                                )}
                                {meta.note && (
                                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                    {meta.note}
                                  </span>
                                )}
                                <p className="text-xs text-stone-500 mt-1">
                                  {nameMap[item.added_by] ? `${nameMap[item.added_by]}` : ''}
                                  {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                                </p>
                                {hasLink && (
                                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                    <LinkIcon className="w-3 h-3" /> Open link
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-none">
                            <button onClick={() => setItemMenu(itemMenu === item.id ? null : item.id!)}
                              className="p-1.5 rounded-lg text-stone-300 hover:text-stone-600 hover:bg-stone-50">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {/* Expandable action menu */}
                        {itemMenu === item.id && (
                          <div className="flex flex-wrap items-center gap-1 ml-10 mt-1.5">
                            <button onClick={() => { setEditingItem(item.id!); setEditText(base); setItemMenu(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-50 text-xs text-stone-600 hover:bg-stone-100">
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => { setEditingNote(editingNote === item.id ? null : item.id!); setNoteText(meta.note); setItemMenu(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-50 text-xs text-stone-600 hover:bg-stone-100">
                              <StickyNote className="w-3 h-3" /> Note
                            </button>
                            <button onClick={() => { const m = parseMeta(item.notes); setEditingDetails(editingDetails === item.id ? null : item.id!); setDetDate(m.date); setDetTime(m.time); setDetLocation(m.location); setDetCategory(item.category && LIST_CATEGORIES.includes(item.category) ? item.category : 'General'); setItemMenu(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-50 text-xs text-stone-600 hover:bg-stone-100">
                              Details
                            </button>
                            <span className="flex items-center gap-0.5 ml-1">
                              <button onClick={() => changeQty(item, -1)} disabled={qty <= 1}
                                className="w-7 h-7 rounded-lg bg-stone-50 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40">−</button>
                              <span className="text-xs font-medium text-stone-600 w-7 text-center">×{qty}</span>
                              <button onClick={() => changeQty(item, 1)}
                                className="w-7 h-7 rounded-lg bg-stone-50 text-sm text-stone-600 hover:bg-stone-100">+</button>
                            </span>
                            <button onClick={() => { handleRemove(item.id!); setItemMenu(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-xs text-red-500 hover:bg-red-100">
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        )}
                        {editingNote === item.id && (
                          <div className="mt-2 ml-10 flex gap-2">
                            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..."
                              className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700" autoFocus />
                            <button onClick={() => handleSaveNote(item.id!)} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                          </div>
                        )}
                        {editingDetails === item.id && (
                          <div className="mt-2 ml-10 grid grid-cols-2 gap-2">
                            <input value={detDate} onChange={e => setDetDate(e.target.value)} type="date"
                              className="px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50" />
                            <input value={detTime} onChange={e => setDetTime(e.target.value)} type="time"
                              className="px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50" />
                            <input value={detLocation} onChange={e => setDetLocation(e.target.value)} placeholder="📍 Location"
                              className="col-span-2 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 bg-stone-50" />
                            <select value={detCategory} onChange={e => setDetCategory(e.target.value)}
                              className="px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50">
                              {LIST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={() => handleSaveDetails(item.id!)} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save details</button>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              ))}

              {checked.length > 0 && (
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[14px] font-semibold text-stone-900">Done ({checked.length})</p>
                    <button onClick={handleClearCompleted}
                      className="text-xs font-medium text-stone-500 hover:text-stone-800 px-2 py-1">
                      Clear completed
                    </button>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {checked.map(item => (
                      <div key={item.id} className="flex items-center gap-3 py-2.5 opacity-60">
                        <button onClick={() => handleToggle(item.id!, item.checked)}
                          className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-none">
                          <Check className="w-4 h-4 text-white" />
                        </button>
                        <span className="flex-1 text-sm text-stone-500 line-through">
                          {parseQty(item.text).base}
                          {parseQty(item.text).qty > 1 && (
                            <span className="ml-2 text-xs font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md no-underline">×{parseQty(item.text).qty}</span>
                          )}
                        </span>
                        <button onClick={() => handleRemove(item.id!)} className="text-stone-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* List settings — members, share code, invite, rename,
              activity, leave. One place, in that order. */}
          <div ref={settingsRef} className="mt-8 pt-6 border-t border-stone-200 space-y-5 scroll-mt-4">
            <p className="text-[14px] font-semibold text-stone-900">List settings</p>

            {/* Members */}
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2">Members ({members.length})</p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-1.5 bg-stone-50 rounded-full px-3 py-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${m.role === 'owner' ? 'bg-amber-200 text-amber-800' : 'bg-stone-200 text-stone-600'}`}>
                      {(m.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-stone-700 font-medium">{m.name || 'Unknown'}</span>
                    {m.role === 'owner' && <Crown className="w-3 h-3 text-amber-500" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Share code — the only place it appears now */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500">Share code</p>
                <p className="text-base font-mono tracking-widest text-stone-900 mt-0.5">{activeHH.shareCode}</p>
              </div>
              <button onClick={() => copyCode(activeHH.shareCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-xs text-stone-700 font-medium">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy code'}
              </button>
            </div>

            {/* Invite link */}
            <button onClick={() => {
              const code = activeHH.shareCode
              navigator.clipboard?.writeText(`Join my LifePilot list "${activeHH.name}"! Code: ${code}\nGet the app: https://getlifepilot.app`).then(() => toast.success('Invite copied!'))
            }} className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium text-center hover:bg-amber-100">
              Share invite link
            </button>

            {/* Rename */}
            {renamingList ? (
              <div className="flex gap-2">
                <input value={renameText} onChange={e => setRenameText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-800" autoFocus />
                <button onClick={async () => {
                  if (renameText.trim() && activeHH) {
                    await renameHousehold(activeHH.id, renameText.trim())
                    setActiveHH({ ...activeHH, name: renameText.trim() })
                    loadHouseholds()
                  }
                  setRenamingList(false)
                }} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                <button onClick={() => setRenamingList(false)} className="px-2 text-stone-400">✕</button>
              </div>
            ) : (
              <button onClick={() => { setRenamingList(true); setRenameText(activeHH.name) }}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-600">
                <Pencil className="w-3 h-3" /> Rename list
              </button>
            )}

            {/* Activity log */}
            <div>
              <button onClick={async () => {
                if (!showLog && activeHH) {
                  const log = await getActivityLog(activeHH.id)
                  setActivityLog(log)
                  const userIds = [...new Set(log.map(l => l.user_id))]
                  const names = { ...nameMap }
                  for (const uid of userIds) { if (!names[uid]) names[uid] = await getUserDisplayName(uid) }
                  setNameMap(names)
                }
                setShowLog(!showLog)
              }} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-600 font-medium">
                <History className="w-3.5 h-3.5" /> {showLog ? 'Hide activity' : 'Activity log'}
              </button>

              {showLog && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-stone-50 pt-2">
                  {activityLog.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No activity yet</p>
                  ) : activityLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs text-stone-500 py-1">
                      <Clock className="w-3 h-3 flex-none mt-0.5 text-stone-300" />
                      <span>
                        <span className="font-medium text-stone-700">{nameMap[entry.user_id] || 'Someone'}</span>
                        {' '}{entry.action}{' '}
                        {entry.item_text && <span className="text-stone-600">"{entry.item_text}"</span>}
                        <span className="text-stone-300 ml-1">{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leave */}
            <button onClick={() => handleLeave(activeHH.id)}
              className="w-full py-2.5 rounded-xl border border-red-100 text-red-400 text-xs font-medium text-center hover:bg-red-50 hover:text-red-600">
              Leave this list
            </button>
          </div>
        </div>
      </div>
    )
  }

  // HOUSEHOLD LIST VIEW
  return (
    <div className={`${isTab ? '' : 'min-h-[100dvh]'} max-w-lg mx-auto bg-[#FAF9F6]`}>
      {!isTab ? (
        <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Shared Lists</h1>
        </header>
      ) : (
        <header className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Shared Lists</h1>
        </header>
      )}

      <div className="p-5 space-y-4">
        {isPremium && (
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false) }}
              className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium">+ New list</button>
            <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false) }}
              className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-medium">Join a list</button>
          </div>
        )}
        {isPremium && showCreate && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-base text-stone-800">Create a Shared List</h3>
            <input value={householdName} onChange={e => setHouseholdName(e.target.value)}
              placeholder="e.g., Family Shopping, Trip Planning"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400" />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-stone-100 text-sm text-stone-600 font-medium">Cancel</button>
              <button onClick={handleCreate} disabled={!householdName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium disabled:opacity-40">Create</button>
            </div>
          </div>
        )}
        {isPremium && showJoin && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="font-semibold text-base text-stone-800 mb-3">Join a list</h3>
            <p className="text-sm text-stone-500 mb-3">Got a code from someone?</p>
            <div className="flex gap-2">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123" maxLength={6}
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-base text-center font-mono tracking-widest text-stone-800" />
              <button onClick={handleJoin} disabled={joinCode.length < 6}
                className="px-5 py-3 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">Join</button>
            </div>
          </div>
        )}
        {households.length > 0 && (
          <div className="divide-y divide-stone-200/70">
            {households.map(hh => (
              <button key={hh.id} onClick={() => openHousehold(hh)}
                className="w-full flex items-center gap-4 py-3 hover:bg-stone-50/60 transition-all text-left">
                <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-none">
                  <Users className="w-6 h-6 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-stone-900 truncate">{hh.name}</p>
                  <p className="text-sm text-stone-500">{hh.memberCount} member{hh.memberCount > 1 ? 's' : ''} · {hh.role}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </button>
            ))}
          </div>
        )}

        {!isPremium && (households.length === 0 ? (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-base text-stone-800 mb-3">Create a Shared List</h3>
              <input value={householdName} onChange={e => setHouseholdName(e.target.value)}
                placeholder="e.g., Family Shopping"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400 mb-3" />
              <button onClick={handleCreate} disabled={!householdName.trim()}
                className="w-full py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium disabled:opacity-40">Create & Get Share Code</button>
            </div>
            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-base text-stone-800 mb-3">Join a list</h3>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123" maxLength={6}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-center font-mono tracking-widest text-stone-800 mb-3" />
              <button onClick={handleJoin} disabled={joinCode.length < 6}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">Join</button>
            </div>
          </>
        ) : (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="text-sm text-amber-800 font-medium mb-1">Want more shared lists?</p>
            <p className="text-sm text-amber-700">Upgrade to Inner Circle or Guided to create unlimited shared lists.</p>
          </div>
        ))}

        {households.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-stone-500">Create a list and share the code with anyone — grocery shopping, trip planning, event coordination, and more.</p>
          </div>
        )}
      </div>
    </div>
  )
}

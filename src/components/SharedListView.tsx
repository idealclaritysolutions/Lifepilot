import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import {
  getMyHouseholds, createHousehold, joinHousehold, leaveHousehold,
  getSharedItems, addSharedItem, toggleSharedItem, removeSharedItem, updateSharedItemNotes, updateSharedItemText,
  subscribeToSharedItems, getUserDisplayName, logActivity, getActivityLog, renameHousehold, getHouseholdMembers,
  type SharedItem, type HouseholdInfo, type ActivityEntry, type HouseholdMember
} from '@/lib/supabase'
import { ArrowLeft, Plus, Users, Copy, Check, Trash2, ShoppingCart, LogOut, Loader2, ChevronRight, StickyNote, Link as LinkIcon, Pencil, ExternalLink, History, Clock, Crown } from 'lucide-react'
import { toast } from 'sonner'
import type { AppState } from '@/App'

interface Props {
  onClose: () => void
  state: AppState
}

function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim())
}

// Intelligent context-aware link generator
function getSmartLink(itemText: string, listName: string): { url: string; label: string } {
  const text = (itemText + ' ' + listName).toLowerCase()
  
  // Travel / Hotels
  if (/hotel|stay|airbnb|lodge|resort|accommodat|booking|check.in|room/i.test(text))
    return { url: `https://www.google.com/travel/hotels?q=${encodeURIComponent(itemText)}`, label: 'Find hotels' }
  // Flights
  if (/flight|fly|airline|airport|travel to|trip to|depart|arrival/i.test(text))
    return { url: `https://www.google.com/travel/flights?q=${encodeURIComponent(itemText)}`, label: 'Find flights' }
  // Restaurants / Food
  if (/restaurant|eat at|dinner at|lunch at|brunch|cafe|bistro|reservat/i.test(text))
    return { url: `https://www.google.com/maps/search/restaurants+${encodeURIComponent(itemText)}`, label: 'Find restaurant' }
  // Locations / Places
  if (/visit|go to|explore|museum|park|beach|landmark|address|location|directions/i.test(text))
    return { url: `https://www.google.com/maps/search/${encodeURIComponent(itemText)}`, label: 'View on map' }
  // Events / Tickets
  if (/ticket|concert|show|event|game|match|perform|movie/i.test(text))
    return { url: `https://www.google.com/search?q=${encodeURIComponent(itemText + ' tickets')}`, label: 'Find tickets' }
  // Recipes
  if (/recipe|cook|bake|make |prepare|ingredient/i.test(text))
    return { url: `https://www.google.com/search?q=${encodeURIComponent(itemText + ' recipe')}`, label: 'Find recipe' }
  // Default: shopping
  return { url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(itemText)}`, label: 'Shop' }
}

export function SharedListView({ onClose, state }: Props) {
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
  const [noteText, setNoteText] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
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
    // Pack metadata into notes as structured data
    const meta: string[] = []
    if (newItemDate) meta.push(`📅 ${newItemDate}`)
    if (newItemTime) meta.push(`🕐 ${newItemTime}`)
    if (newItemLocation) meta.push(`📍 ${newItemLocation}`)
    if (newItemNote.trim()) meta.push(newItemNote.trim())
    const fullNotes = meta.join(' · ') || undefined
    
    await addSharedItem({
      household_id: activeHH.id,
      text: newItem.trim(),
      category: 'grocery',
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
    if (!confirm('Remove this item?')) return
    const item = items.find(i => i.id === id)
    await removeSharedItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (activeHH?.id && user?.id && item) {
      await logActivity(activeHH.id, user.id, 'removed', item.text)
    }
  }

  const handleSaveNote = async (id: string) => {
    await updateSharedItemNotes(id, noteText)
    setItems(prev => prev.map(i => i.id === id ? { ...i, notes: noteText } : i))
    setEditingNote(null)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return
    await updateSharedItemText(id, editText.trim())
    setItems(prev => prev.map(i => i.id === id ? { ...i, text: editText.trim() } : i))
    setEditingItem(null)
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

  // Not signed in
  // Not signed in OR not on the right plan
  if (!user || !isPremium) {
    return (
      <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Shared Lists</h1>
        </header>
        <div className="p-5 space-y-5">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center mx-auto mb-4">
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
              { icon: '🔗', title: 'Shoppable links', desc: 'Tap any item to shop it instantly on Amazon, Walmart, Target and more.' },
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

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 text-center">
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
    const unchecked = items.filter(i => !i.checked)
    const checked = items.filter(i => i.checked)

    return (
      <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <button onClick={() => { setActiveHH(null); setItems([]); sessionStorage.removeItem("lp-active-list") }} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>{activeHH.name}</h1>
            <p className="text-xs text-stone-500">{activeHH.memberCount} member{activeHH.memberCount > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => copyCode(activeHH.shareCode)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-xs font-medium text-stone-700">
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : activeHH.shareCode}
          </button>
        </header>

        <div className="p-4 space-y-3">
          {/* Add item */}
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
            {newItem.trim() && (
              <>
                <button onClick={() => setShowItemDetails(!showItemDetails)}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium px-1">
                  {showItemDetails ? '− Less details' : '+ Add date, time, location, note'}
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
                  </div>
                )}
                {!showItemDetails && (
                  <input value={newItemNote} onChange={e => setNewItemNote(e.target.value)}
                    placeholder="Quick note (optional)..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-100 text-sm text-stone-700 placeholder:text-stone-400 bg-stone-50/50" />
                )}
              </>
            )}
          </div>

          {/* Items */}
          {unchecked.length === 0 && checked.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-base text-stone-600 font-medium">Your list is empty</p>
              <p className="text-sm text-stone-500 mt-1">Add items above — they'll appear for everyone</p>
            </div>
          ) : (
            <>
              {unchecked.map(item => {
                const hasLink = !!item.link && isUrl(item.link)
                return (
                <div key={item.id} className="bg-white rounded-xl border border-stone-100 px-4 py-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <button onClick={() => handleToggle(item.id!, item.checked)}
                      className="w-7 h-7 rounded-full border-2 border-lime-400 flex-none hover:bg-lime-50 mt-0.5" />
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
                          <span className="text-base text-stone-800 font-medium">{item.text}</span>
                          {/* Notes with date/time/location metadata */}
                          {item.notes && (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                              {item.notes}
                            </span>
                          )}
                          {/* Attribution line */}
                          <span className="text-xs text-stone-400">
                            {nameMap[item.added_by] ? `${nameMap[item.added_by]}` : ''}
                            {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          </span>
                          {hasLink && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <LinkIcon className="w-3 h-3" /> Open link
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      {/* Smart contextual link: shops, hotels, flights, maps, etc. */}
                      {!hasLink && !item.checked && (() => {
                        const smart = getSmartLink(item.text, activeHH?.name || '')
                        return (
                          <a href={smart.url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 flex items-center gap-1" title={smart.label}>
                            <ExternalLink className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">{smart.label}</span>
                          </a>
                        )
                      })()}
                      <button onClick={() => { setEditingItem(item.id!); setEditText(item.text) }}
                        className="p-1.5 rounded-lg text-stone-300 hover:text-stone-600 hover:bg-stone-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingNote(editingNote === item.id ? null : item.id!); setNoteText(item.notes || '') }}
                        className={`p-1.5 rounded-lg ${item.notes ? 'text-amber-500' : 'text-stone-300'} hover:bg-stone-50`}>
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleRemove(item.id!)} className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.notes && editingNote !== item.id && (
                    <p className="text-sm text-stone-500 mt-1.5 ml-10 italic">{item.notes}</p>
                  )}
                  {editingNote === item.id && (
                    <div className="mt-2 ml-10 flex gap-2">
                      <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..."
                        className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700" autoFocus />
                      <button onClick={() => handleSaveNote(item.id!)} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                    </div>
                  )}
                </div>
              )})}

              {checked.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Done ({checked.length})</p>
                  {checked.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
                      <button onClick={() => handleToggle(item.id!, item.checked)}
                        className="w-7 h-7 rounded-full bg-lime-500 flex items-center justify-center flex-none">
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <span className="flex-1 text-sm text-stone-500 line-through">{item.text}</span>
                      <button onClick={() => handleRemove(item.id!)} className="text-stone-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* List Management Panel */}
          <div className="mt-6 space-y-3">
            {/* Quick actions row */}
            <div className="flex gap-2">
              <button onClick={() => {
                const checked = items.filter(i => i.checked)
                if (checked.length === 0) { toast('No completed items to clear'); return }
                if (!confirm(`Remove ${checked.length} completed item${checked.length > 1 ? 's' : ''}?`)) return
                checked.forEach(i => { removeSharedItem(i.id!); if (activeHH?.id && user?.id) logActivity(activeHH.id, user.id, 'cleared completed', i.text) })
                setItems(prev => prev.filter(i => !i.checked))
                toast.success(`${checked.length} completed items cleared`)
              }} className="flex-1 py-2.5 rounded-xl bg-stone-50 text-stone-600 text-xs font-medium text-center hover:bg-stone-100">
                Clear completed ({items.filter(i => i.checked).length})
              </button>
              <button onClick={() => {
                const code = activeHH.shareCode
                navigator.clipboard?.writeText(`Join my LifePilot list "${activeHH.name}"! Code: ${code}\nGet the app: https://getlifepilot.app`).then(() => toast.success('Invite copied!'))
              }} className="flex-1 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium text-center hover:bg-amber-100">
                Share invite link
              </button>
            </div>

            {/* Share code */}
            <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Share Code</p>
                <button onClick={() => copyCode(activeHH.shareCode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-xs text-stone-700 font-medium">
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : activeHH.shareCode}
                </button>
              </div>
            
              {/* Rename */}
              {renamingList ? (
                <div className="flex gap-2 mb-3">
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
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-600 mb-3">
                  <Pencil className="w-3 h-3" /> Rename list
                </button>
              )}

              {/* Members */}
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Members ({members.length})
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
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

              {/* Activity log */}
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

            {/* Danger zone */}
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
    <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-stone-700" />
        </button>
        <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Shared Lists</h1>
      </header>

      <div className="p-5 space-y-4">
        {households.length > 0 && (
          <div className="space-y-3">
            {households.map(hh => (
              <button key={hh.id} onClick={() => openHousehold(hh)}
                className="w-full flex items-center gap-4 bg-white rounded-2xl border border-stone-100 p-4 shadow-sm hover:border-amber-200 transition-all text-left">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center flex-none">
                  <Users className="w-6 h-6 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-stone-800 truncate">{hh.name}</p>
                  <p className="text-sm text-stone-500">{hh.memberCount} member{hh.memberCount > 1 ? 's' : ''} · {hh.role}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </button>
            ))}
          </div>
        )}

        {isPremium ? (
          <>
            {showCreate ? (
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
            ) : (
              <button onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-dashed border-stone-200 hover:border-amber-300 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-none">
                  <Plus className="w-6 h-6 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-stone-800">Create a new list</p>
                  <p className="text-sm text-stone-500">Share with family, friends, or anyone</p>
                </div>
              </button>
            )}

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
          </>
        ) : households.length === 0 ? (
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
        )}

        {households.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-stone-500">Create a list and share the code with anyone — grocery shopping, trip planning, event coordination, and more.</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import {
  getMyHouseholds, createHousehold, joinHousehold, leaveHousehold,
  getSharedItems, addSharedItem, toggleSharedItem, removeSharedItem, updateSharedItemNotes, updateSharedItemText,
  subscribeToSharedItems, type SharedItem, type HouseholdInfo
} from '@/lib/supabase'
import { ArrowLeft, Plus, Users, Copy, Check, Trash2, ShoppingCart, LogOut, Loader2, ChevronRight, StickyNote, Link as LinkIcon, Pencil, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { AppState } from '@/App'

interface Props {
  onClose: () => void
  state: AppState
}

function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim())
}

function shopSearchUrl(itemText: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(itemText)}`
}

export function SharedListView({ onClose, state }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [households, setHouseholds] = useState<HouseholdInfo[]>([])
  const [activeHH, setActiveHH] = useState<HouseholdInfo | null>(null)
  const [items, setItems] = useState<SharedItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const isPremium = state.subscription.tier === 'premium' || state.subscription.tier === 'enterprise'

  const loadHouseholds = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const hhs = await getMyHouseholds(user.id)
    setHouseholds(hhs)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadHouseholds() }, [loadHouseholds])

  const openHousehold = async (hh: HouseholdInfo) => {
    setActiveHH(hh)
    const sharedItems = await getSharedItems(hh.id)
    setItems(sharedItems)
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
    await addSharedItem({
      household_id: activeHH.id,
      text: newItem.trim(),
      category: 'grocery',
      checked: false,
      added_by: user.id,
      notes: newItemNote.trim() || undefined,
    })
    setNewItem('')
    setNewItemNote('')
    const updated = await getSharedItems(activeHH.id)
    setItems(updated)
  }

  const handleToggle = async (id: string, checked: boolean) => {
    await toggleSharedItem(id, !checked)
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i))
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this item?')) return
    await removeSharedItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
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
    if (activeHH?.id === hhId) { setActiveHH(null); setItems([]) }
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
              { icon: '🤖', title: 'AI-powered list building', desc: 'Ask LifePilot to find products, compare prices, and add them with links — straight to your shared list.' },
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
          <button onClick={() => { setActiveHH(null); setItems([]) }} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddItem()}
                placeholder="Add to list..."
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400" />
              <button onClick={handleAddItem} disabled={!newItem.trim()}
                className="px-4 py-3 rounded-xl bg-lime-500 text-white disabled:opacity-40">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {newItem.trim() && (
              <input value={newItemNote} onChange={e => setNewItemNote(e.target.value)}
                placeholder="Add a note (optional)..."
                className="w-full px-4 py-2 rounded-xl border border-stone-100 text-sm text-stone-700 placeholder:text-stone-400 bg-stone-50" />
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
                          {hasLink && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 mt-0.5 hover:underline">
                              <LinkIcon className="w-3 h-3" /> Open link
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      {/* Shop button: show for non-link items */}
                      {!hasLink && !item.checked && (
                        <a href={shopSearchUrl(item.text)} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50" title="Shop this item">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
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

          {/* Household actions */}
          <div className="bg-white rounded-xl border border-stone-100 p-4 mt-4 shadow-sm">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">List info</p>
            <p className="text-sm text-stone-700 mb-1">Share code: <span className="font-mono font-bold text-stone-800">{activeHH.shareCode}</span></p>
            <p className="text-sm text-stone-600 mb-3">{activeHH.memberCount} member{activeHH.memberCount > 1 ? 's' : ''} connected</p>
            <button onClick={() => handleLeave(activeHH.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium">
              <LogOut className="w-3.5 h-3.5" /> Leave this list
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

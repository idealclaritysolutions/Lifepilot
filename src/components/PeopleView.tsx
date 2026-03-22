import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AppState, Person, LifeEvent } from '@/App'
import { TIER_LIMITS, hasFeature } from '@/App'
import { uid } from '@/lib/ai-engine'
import { Plus, Heart, Users, Star, ChevronRight, Gift, Calendar, Trash2, X, Edit3, Lock } from 'lucide-react'

interface Props {
  state: AppState
  addPerson: (person: Person) => void
  updatePerson: (id: string, updates: Partial<Person>) => void
  removePerson: (id: string) => void
}

const EVENT_TYPES = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'anniversary', label: '💍 Anniversary' },
  { value: 'wedding', label: '💒 Wedding' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'reunion', label: '🤝 Reunion' },
  { value: 'memorial', label: '🕯️ Memorial' },
  { value: 'custom', label: '📅 Custom' },
] as const

const CLOSENESS_CONFIG = {
  'inner-circle': { label: 'Inner Circle', emoji: '❤️', color: 'bg-rose-50 text-rose-700 border-rose-200', desc: '2 weeks → 1 week → 1 day → day-of reminders' },
  'close': { label: 'Close', emoji: '🧡', color: 'bg-orange-50 text-orange-700 border-orange-200', desc: '1 week → 3 days → 1 day → day-of reminders' },
  'casual': { label: 'Casual', emoji: '💛', color: 'bg-amber-50 text-amber-700 border-amber-200', desc: '1 day → day-of reminders' },
}

function getUpcomingEvents(people: Person[]): { person: Person; event: LifeEvent; daysUntil: number; nextDate: Date }[] {
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const results: { person: Person; event: LifeEvent; daysUntil: number; nextDate: Date }[] = []

  people.forEach(person => {
    person.events.forEach(event => {
      const mmdd = event.date.length === 5 ? event.date : event.date.substring(5)
      const [mm, dd] = mmdd.split('-').map(Number)
      const thisYear = now.getFullYear()
      let eventDate = new Date(thisYear, mm - 1, dd)
      if (eventDate < todayMidnight) eventDate = new Date(thisYear + 1, mm - 1, dd)
      const daysUntil = Math.round((eventDate.getTime() - todayMidnight.getTime()) / 86400000)
      results.push({ person, event, daysUntil, nextDate: eventDate })
    })
  })

  return results.sort((a, b) => a.daysUntil - b.daysUntil)
}

export function PeopleView({ state, addPerson, updatePerson, removePerson }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const upcoming = getUpcomingEvents(state.people)
  const next30 = upcoming.filter(u => u.daysUntil <= 30)

  return (
    <div className="p-4 space-y-4">
      {/* Upcoming Events Banner */}
      {next30.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl border border-rose-100 p-4">
          <h3 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-3">
            🗓 Coming Up
          </h3>
          <div className="space-y-2.5">
            {next30.slice(0, 5).map(({ person, event, daysUntil, nextDate }) => {
              const yearInfo = event.year
                ? event.type === 'birthday'
                  ? ` — turning ${nextDate.getFullYear() - event.year}`
                  : ` — ${nextDate.getFullYear() - event.year} years`
                : ''
              const urgency = daysUntil === 0 ? 'TODAY!' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`

              return (
                <div key={`${person.id}-${event.id}`} className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    daysUntil === 0 ? 'bg-rose-500 text-white animate-pulse' :
                    daysUntil <= 3 ? 'bg-orange-100' : 'bg-stone-100'
                  }`}>
                    {event.type === 'birthday' ? '🎂' : event.type === 'anniversary' ? '💍' : event.type === 'wedding' ? '💒' : event.type === 'graduation' ? '🎓' : event.type === 'reunion' ? '🤝' : event.type === 'memorial' ? '🕯️' : '📅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800 truncate">{person.name}'s {event.label}</p>
                    <p className="text-xs text-stone-600">
                      {nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{yearInfo}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    daysUntil === 0 ? 'bg-rose-500 text-white' :
                    daysUntil <= 3 ? 'bg-orange-100 text-orange-700' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {urgency}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Person Button */}
      {state.people.length >= TIER_LIMITS[state.subscription.tier].maxPeople ? (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-center">
          <Lock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-amber-800 font-medium">You've reached your limit of {TIER_LIMITS[state.subscription.tier].maxPeople} people</p>
          <p className="text-xs text-amber-700 mt-1">Upgrade to Life Pilot for unlimited people tracking. Tap 👑 to view plans.</p>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-dashed border-stone-200 hover:border-rose-300 hover:bg-rose-50/30 transition-all group">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
            <Plus className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-stone-700">Add someone important</p>
            <p className="text-xs text-stone-600">Birthdays, anniversaries, weddings & more</p>
          </div>
        </button>
      )}

      {/* Add Person Form */}
      {showAdd && <AddPersonForm onSave={(p) => { addPerson(p); setShowAdd(false) }} onCancel={() => setShowAdd(false)} />}

      {/* People List */}
      {state.people.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-rose-300" />
          </div>
          <h3 className="text-base font-semibold text-stone-700 mb-1" style={{ fontFamily: "'Georgia', serif" }}>
            Your people, remembered
          </h3>
          <p className="text-sm text-stone-600 max-w-xs mx-auto">
            Add the people who matter to you. Life Pilot AI will remind you of their birthdays, anniversaries, and special moments — so you never miss one.
          </p>
          <p className="text-xs text-stone-600 mt-3">
            Or just tell me in chat: "My mom's birthday is March 15"
          </p>
        </div>
      )}

      {/* People cards grouped by closeness */}
      {['inner-circle', 'close', 'casual'].map(tier => {
        const people = state.people.filter(p => p.closeness === tier)
        if (people.length === 0) return null
        const config = CLOSENESS_CONFIG[tier as keyof typeof CLOSENESS_CONFIG]

        return (
          <div key={tier}>
            <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2 px-1">
              {config.emoji} {config.label} ({people.length})
            </h3>
            <div className="space-y-2">
              {people.map(person => (
                <PersonCard
                  key={person.id}
                  person={person}
                  expanded={expandedId === person.id}
                  editing={editingId === person.id}
                  upcoming={upcoming.filter(u => u.person.id === person.id)}
                  onToggle={() => setExpandedId(expandedId === person.id ? null : person.id)}
                  onEdit={() => setEditingId(editingId === person.id ? null : person.id)}
                  onUpdate={(updates) => updatePerson(person.id, updates)}
                  onRemove={() => removePerson(person.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Person Card ────────────────────────────────────────────────────

function PersonCard({ person, expanded, editing, upcoming, onToggle, onEdit, onUpdate, onRemove }: {
  person: Person
  expanded: boolean
  editing: boolean
  upcoming: { event: LifeEvent; daysUntil: number; nextDate: Date }[]
  onToggle: () => void
  onEdit: () => void
  onUpdate: (updates: Partial<Person>) => void
  onRemove: () => void
}) {
  const nextEvent = upcoming[0]
  const config = CLOSENESS_CONFIG[person.closeness]

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50/50 transition-colors">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${config.color}`}>
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-stone-800 truncate">{person.name}</p>
            <span className="text-xs text-stone-600">{person.relationship}</span>
          </div>
          {nextEvent && (
            <p className="text-xs text-stone-600 truncate">
              {nextEvent.event.label} {nextEvent.daysUntil === 0 ? '🎉 today!' : nextEvent.daysUntil <= 7 ? `in ${nextEvent.daysUntil} days` : nextEvent.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <ChevronRight className={`w-4 h-4 text-stone-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-50">
          {/* Events */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Events</p>
            {person.events.length === 0 ? (
              <p className="text-xs text-stone-600 italic">No events yet</p>
            ) : (
              <div className="space-y-1.5">
                {person.events.map(event => {
                  const up = upcoming.find(u => u.event.id === event.id)
                  return (
                    <div key={event.id} className="flex items-center gap-2 text-xs bg-stone-50 rounded-lg px-3 py-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-600" />
                      <span className="flex-1 text-stone-600">{event.label}</span>
                      <span className="text-stone-600">{event.date}{event.year ? ` (${event.year})` : ''}</span>
                      {up && up.daysUntil <= 7 && (
                        <span className="text-xs font-bold text-rose-500">{up.daysUntil === 0 ? 'TODAY' : `${up.daysUntil}d`}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          {person.notes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-stone-500 leading-relaxed">{person.notes}</p>
            </div>
          )}

          {/* Gift History */}
          {person.giftHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Gift History</p>
              {person.giftHistory.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-stone-500">
                  <Gift className="w-3 h-3 text-stone-600" />
                  <span>{g.description}</span>
                  <span className="text-stone-600">({new Date(g.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</span>
                </div>
              ))}
            </div>
          )}

          {/* Closeness tier — tap to reclassify */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Closeness (tap to change)</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(CLOSENESS_CONFIG) as [Person['closeness'], typeof CLOSENESS_CONFIG['inner-circle']][]).map(([key, cfg]) => (
                <button key={key} onClick={() => onUpdate({ closeness: key })}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    person.closeness === key ? cfg.color + ' border-current font-medium' : 'border-stone-100 text-stone-600 hover:border-stone-200'
                  }`}>
                  <span className="text-sm">{cfg.emoji}</span>
                  <p className="text-[9px] mt-0.5">{cfg.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-1.5 text-center">{config.desc}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 text-xs text-stone-600 transition-colors">
              <Edit3 className="w-3 h-3" /> {editing ? 'Cancel Edit' : 'Edit'}
            </button>
            <button onClick={onRemove} className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-red-50 hover:bg-red-100 text-xs text-red-600 transition-colors">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>

          {/* Edit form */}
          {editing && <PersonEditForm person={person} onUpdate={onUpdate} onDone={onEdit} />}
        </div>
      )}
    </div>
  )
}

// ─── Edit Person Form ───────────────────────────────────────────────

function PersonEditForm({ person, onUpdate, onDone }: { person: Person; onUpdate: (u: Partial<Person>) => void; onDone: () => void }) {
  const [name, setName] = useState(person.name)
  const [relationship, setRelationship] = useState(person.relationship)
  const [notes, setNotes] = useState(person.notes || '')
  const [events, setEvents] = useState<LifeEvent[]>(person.events)
  const [addingEvent, setAddingEvent] = useState(false)

  return (
    <div className="space-y-3 pt-2 border-t border-stone-100">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Edit Details</p>

      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800" />
      <input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Relationship (e.g., Mom, Partner, Coworker)"
        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (interests, preferences, etc.)" rows={2}
        className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 resize-none" />

      {/* Important Dates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Important Dates</p>
          {!addingEvent && (
            <button onClick={() => setAddingEvent(true)} className="text-xs text-rose-500 font-medium hover:text-rose-600">+ Add date</button>
          )}
        </div>

        {events.length === 0 && !addingEvent && (
          <p className="text-xs text-stone-400 italic">No dates yet — add a birthday, anniversary, and more</p>
        )}

        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-2 mb-1.5 bg-stone-50 rounded-lg px-3 py-2 text-xs">
            <span>{EVENT_TYPES.find(t => t.value === event.type)?.label.split(' ')[0] || '📅'}</span>
            <span className="flex-1 text-stone-600">{event.label} — {event.date}{event.year ? ` (${event.year})` : ''}</span>
            <button onClick={() => setEvents(events.filter(e => e.id !== event.id))} className="text-stone-400 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {addingEvent && (
          <AddEventForm
            onAdd={(e) => { setEvents([...events, e]); setAddingEvent(false) }}
            onCancel={() => setAddingEvent(false)}
          />
        )}
      </div>

      <button onClick={() => {
        if (name.trim()) {
          onUpdate({ name: name.trim(), relationship: relationship.trim() || person.relationship, notes: notes.trim(), events })
          onDone()
        }
      }} className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium">
        Save Changes
      </button>
    </div>
  )
}

// ─── Add Person Form ────────────────────────────────────────────────

function AddPersonForm({ onSave, onCancel }: { onSave: (p: Person) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [closeness, setCloseness] = useState<Person['closeness']>('close')
  const [notes, setNotes] = useState('')
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [addingEvent, setAddingEvent] = useState(false)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: uid(),
      name: name.trim(),
      relationship: relationship.trim() || 'Friend',
      closeness,
      events,
      notes: notes.trim(),
      giftHistory: [],
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-800 text-sm" style={{ fontFamily: "'Georgia', serif" }}>Add someone</h3>
        <button onClick={onCancel} className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center">
          <X className="w-4 h-4 text-stone-600" />
        </button>
      </div>

      <div className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-rose-300" />

        <input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Relationship (Mom, Best friend, Coworker...)"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-rose-300" />

        {/* Closeness tier */}
        <div>
          <p className="text-xs text-stone-600 mb-2">How close are you?</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(CLOSENESS_CONFIG) as [Person['closeness'], typeof CLOSENESS_CONFIG['inner-circle']][]).map(([key, config]) => (
              <button key={key} onClick={() => setCloseness(key)}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  closeness === key ? config.color + ' border-current font-medium' : 'border-stone-100 text-stone-600 hover:border-stone-200'
                }`}>
                <span className="text-base">{config.emoji}</span>
                <p className="text-xs mt-0.5">{config.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-stone-600">Important dates</p>
            <button onClick={() => setAddingEvent(true)} className="text-xs text-rose-500 font-medium hover:text-rose-600">+ Add date</button>
          </div>

          {events.map((event, i) => (
            <div key={event.id} className="flex items-center gap-2 mb-1.5 bg-stone-50 rounded-lg px-3 py-2 text-xs">
              <span>{EVENT_TYPES.find(t => t.value === event.type)?.label.split(' ')[0] || '📅'}</span>
              <span className="flex-1 text-stone-600">{event.label} — {event.date}</span>
              <button onClick={() => setEvents(events.filter((_, j) => j !== i))} className="text-stone-600 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {addingEvent && <AddEventForm onAdd={(e) => { setEvents([...events, e]); setAddingEvent(false) }} onCancel={() => setAddingEvent(false)} />}
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes — likes sushi, allergic to cats, just got promoted..."
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-rose-300 resize-none" rows={2} />
      </div>

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim()} className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white">Save</Button>
      </div>
    </div>
  )
}

// ─── Add Event Mini-Form ────────────────────────────────────────────

function AddEventForm({ onAdd, onCancel }: { onAdd: (e: LifeEvent) => void; onCancel: () => void }) {
  const [type, setType] = useState<LifeEvent['type']>('birthday')
  const [label, setLabel] = useState('Birthday')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')

  const handleTypeChange = (t: LifeEvent['type']) => {
    setType(t)
    const found = EVENT_TYPES.find(et => et.value === t)
    if (found) setLabel(found.label.split(' ').slice(1).join(' ') || t)
  }

  const handleAdd = () => {
    if (!month || !day) return
    const mm = month.padStart(2, '0')
    const dd = day.padStart(2, '0')
    onAdd({
      id: uid(),
      label,
      type,
      date: `${mm}-${dd}`,
      year: year ? parseInt(year) : undefined,
      recurring: type !== 'wedding' && type !== 'graduation' && type !== 'reunion',
      notes: '',
    })
  }

  return (
    <div className="bg-rose-50/50 rounded-xl p-3 space-y-2.5 border border-rose-100">
      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {EVENT_TYPES.map(t => (
          <button key={t.value} onClick={() => handleTypeChange(t.value)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
              type === t.value ? 'bg-rose-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {type === 'custom' && (
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Event name"
          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs" />
      )}

      {/* Date inputs */}
      <div className="flex gap-2">
        <input value={month} onChange={e => setMonth(e.target.value)} placeholder="MM" maxLength={2}
          className="w-16 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-center" />
        <input value={day} onChange={e => setDay(e.target.value)} placeholder="DD" maxLength={2}
          className="w-16 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-center" />
        <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year (optional)" maxLength={4}
          className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs" />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg bg-white text-xs text-stone-500 hover:bg-stone-50">Cancel</button>
        <button onClick={handleAdd} disabled={!month || !day} className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white text-xs hover:bg-rose-600 disabled:opacity-40">Add</button>
      </div>
    </div>
  )
}

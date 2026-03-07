import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AppState, JournalEntry } from '@/App'
import { hasFeature } from '@/App'
import { uid } from '@/lib/ai-engine'
import { BookOpen, ChevronRight, Sparkles, Mic, MicOff, Search, X, TrendingUp, Calendar, Trash2, Pencil, Lock } from 'lucide-react'

interface Props {
  state: AppState
  addJournalEntry: (entry: JournalEntry) => void
  deleteJournalEntry: (id: string) => void
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void
}

const MOODS: { value: JournalEntry['mood']; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😊', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'tough', emoji: '😔', label: 'Tough' },
  { value: 'rough', emoji: '😩', label: 'Rough' },
]

const PROMPTS = [
  "What's one thing that went well today?",
  "What are you grateful for right now?",
  "What's weighing on your mind?",
  "What would make tomorrow better?",
  "What's a small win you can celebrate?",
  "How did you take care of yourself today?",
  "What did you learn about yourself recently?",
  "What's something you're proud of this week?",
]

// ─── THEME EXTRACTION ──────────────────────────────────────────────
const THEME_DEFS: { id: string; label: string; emoji: string; color: string; patterns: RegExp }[] = [
  { id: 'achievement', label: 'Wins & Achievements', emoji: '🏆', color: 'bg-amber-50 text-amber-700', patterns: /accomplish|achiev|finish|complet|proud|success|won |nailed|crushed it|milestone|shipped|launch|did it|made it|pulled off|recogni[zs]|accolade|award|promot|praised|acknowledged|commend|honor|celebrated|selected|chosen|impact|deliver|exceed|surpass|hit .{0,10}(goal|target)|closed .{0,5}deal|landed|signed|approved/i },
  { id: 'growth', label: 'Personal Growth', emoji: '🌱', color: 'bg-emerald-50 text-emerald-700', patterns: /learn|grew|grown|grow|improv|realiz|understand|insight|aware|mindset|progress|better than|develop|evolv|breakthrough|perspective|self.discover|reflect|shift|changed my|new way|open.minded|comfort zone|level up/i },
  { id: 'gratitude', label: 'Gratitude', emoji: '🙏', color: 'bg-purple-50 text-purple-700', patterns: /grateful|thankful|gratitude|appreciat|blessed|fortunate|lucky to|glad |thank god|thank you|so thankful|give thanks|counting .{0,10}blessing/i },
  { id: 'impact', label: 'Making an Impact', emoji: '🌟', color: 'bg-cyan-50 text-cyan-700', patterns: /helped (someone|them|her|him|my|a |people)|made a difference|changed .{0,15}life|mentor|coach|support(ed|ing) (them|her|him|my|people|client)|client.{0,20}(grateful|thank)|gave back|volunteer|inspir(ed|ing) (someone|them|people|others)|empower|guide|lift(ed)?|encourage/i },
  { id: 'resilience', label: 'Resilience & Grit', emoji: '💪', color: 'bg-blue-50 text-blue-700', patterns: /tough (day|week|time)|hard but|challeng|difficult|struggle|push(ed)? through|kept going|didn.t give up|persever|endur|bounce back|overcame|despite|survived|managed to|got through|hung in|stayed strong|never quit|powered through/i },
  { id: 'stress', label: 'Stress & Pressure', emoji: '😤', color: 'bg-red-50 text-red-700', patterns: /stress|overwhelm|anxious|anxiety|pressure|too much|can.t handle|burned out|burnout|deadlin|frantic|drowning|stretched thin|breaking point|weight on|so much going on/i },
  { id: 'relationships', label: 'Relationships', emoji: '❤️', color: 'bg-rose-50 text-rose-700', patterns: /friend|family|partner|spouse|husband|wife|love|relationship|connect|deep conversation|support(ed|ive)|together|bond|trust|miss (them|her|him|you)|quality time|meaningful|close to|opened up|vulnerab/i },
  { id: 'health', label: 'Health & Wellness', emoji: '🧘', color: 'bg-teal-50 text-teal-700', patterns: /exercise|workout|gym|sleep|tired|energy|meditat|yoga|walk(ed)?|run |running|health|water|diet|weight|rest|heal|stretch|physic|body|mental health|therapy|therap/i },
  { id: 'career', label: 'Work & Career', emoji: '💼', color: 'bg-indigo-50 text-indigo-700', patterns: /work |job |career|project|meeting|boss|manager|interview|client|deadline|team |colleague|office|company|business|professional|presentation|pitch|strategy/i },
  { id: 'creativity', label: 'Creativity & Ideas', emoji: '💡', color: 'bg-yellow-50 text-yellow-700', patterns: /idea|creat(ed|ive|ing)|inspir(ed|ation)|build|design|writ(e|ing|ten)|art |music|imagine|innovat|brainstorm|concept|vision|invent|prototype|experiment/i },
  { id: 'finance', label: 'Money & Finance', emoji: '💰', color: 'bg-green-50 text-green-700', patterns: /money|budget|sav(e|ed|ing)|spend|invest|bill|debt|income|salary|financ|afford|price|cost|paid|earning|revenue|profit|net worth/i },
  { id: 'selfcare', label: 'Self-Care', emoji: '🧡', color: 'bg-orange-50 text-orange-700', patterns: /self.care|relax|treat myself|pamper|boundar(y|ies)|said no|alone time|recharge|decompress|take a break|indulg|permission to|guilt.free|chose myself|me time/i },
  { id: 'confidence', label: 'Confidence', emoji: '⭐', color: 'bg-yellow-50 text-yellow-700', patterns: /confiden|believe in (myself|me)|capable|strong enough|brave|courage|fearless|own it|stood up|spoke up|assert|proud of myself|backed myself|trust(ed)? myself|i can do|i.m enough|worthy/i },
  { id: 'leadership', label: 'Leadership', emoji: '👑', color: 'bg-violet-50 text-violet-700', patterns: /led |lead(ing)?|delegat|decision.mak|took charge|step(ped)? up|manage(d)? .{0,5}team|organiz|direct(ed|ing)|own(ed|ing) the|accountab|responsib|initiative/i },
  { id: 'fear', label: 'Fear & Doubt', emoji: '🌫️', color: 'bg-slate-50 text-slate-700', patterns: /afraid|fear|doubt|uncertain|worry|worries|nervous|imposter|not good enough|scared|hesitat|second.guess|what if|anxious about|dread|paralyz/i },
  { id: 'joy', label: 'Joy & Happiness', emoji: '✨', color: 'bg-pink-50 text-pink-700', patterns: /happy|joy(ful)?|excit|wonderful|amazing|fantastic|love(d)? (it|this|that|today)|laugh|fun |delight|bliss|thrilled|elated|best day|great day|so good|incredible|blessed/i },
]

export function extractThemes(text: string): string[] {
  const themes = THEME_DEFS.filter(t => t.patterns.test(text)).map(t => t.id)
  const lower = text.toLowerCase()
  if (/client|customer|coworker|colleague|team|boss|friend/.test(lower) && /grateful|thank|appreciat/.test(lower)) {
    if (!themes.includes('impact')) themes.push('impact')
    if (!themes.includes('achievement')) themes.push('achievement')
    if (!/\b(i.m |i am |i feel )(grateful|thankful)/.test(lower)) {
      const gi = themes.indexOf('gratitude')
      if (gi !== -1) themes.splice(gi, 1)
    }
  }
  return themes
}

function getThemeConfig(id: string) {
  return THEME_DEFS.find(t => t.id === id)
}

// ─── AI REFLECTIONS ─────────────────────────────────────────────────

function getAIReflection(content: string, mood: JournalEntry['mood'], themes: string[]): string {
  // Use content hash to select variation so same content = same reflection, different content = different reflection
  const hash = content.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  const pick = (arr: string[]) => arr[Math.abs(hash) % arr.length]

  // Content-aware keywords for personalization
  const words = content.toLowerCase()
  const mentionsPeople = /\b(friend|family|mom|dad|partner|wife|husband|boss|coworker|colleague|child|daughter|son|sister|brother)\b/.test(words)
  const mentionsWork = /\b(work|job|career|meeting|project|deadline|office|client|presentation)\b/.test(words)
  const mentionsHealth = /\b(exercise|workout|gym|run|walk|sleep|health|eating|diet|meditation|meditate)\b/.test(words)

  if (themes.includes('impact'))
    return pick([
      "You made a real difference today. That kind of impact ripples outward in ways you may never fully see — but it's real, and it matters.",
      "Most people wait for permission to make an impact. You didn't. That says something profound about who you are at your core.",
      "What you did today didn't just help someone — it showed them what's possible. That's the kind of influence that compounds.",
    ])
  if (themes.includes('achievement') && themes.includes('confidence'))
    return pick([
      "This entry is evidence. Bookmark it for the days when doubt tries to rewrite your story — because today, you proved it wrong.",
      "Recognition doesn't arrive by accident. Someone saw your work and your value. Let that sink in before you move to the next thing.",
      "Confidence backed by real achievement isn't arrogance — it's clarity. You know what you're capable of. Today confirmed it.",
    ])
  if (themes.includes('achievement'))
    return pick([
      "This is a real win. Not a footnote — a chapter. Come back to this entry on the tough days and let it remind you who you are.",
      "You earned this. Not by luck, not by timing — by showing up and doing the work. That's the part nobody sees but you know is real.",
      "Achievement unlocked. Now here's the secret: the person who did this today is the same person who can do it again tomorrow.",
    ])
  if (themes.includes('leadership'))
    return pick([
      "Leading isn't comfortable, but you stepped up anyway. The people around you noticed — even if they didn't say it.",
      "Leadership isn't about having all the answers. It's about being willing to go first. Today, you did exactly that.",
    ])
  if (themes.includes('resilience'))
    return pick([
      "You pushed through something hard today. That builds a kind of strength that doesn't show up on a résumé — but it shows up in your life.",
      "The next hard thing will feel slightly less impossible because of what you endured today. That's resilience being forged in real time.",
      "Most people fold when it gets uncomfortable. You didn't. That's not something you can teach — it's something you live.",
    ])
  if (themes.includes('growth'))
    return pick([
      "The fact that you're noticing your own growth IS growth. Most people sleepwalk through their patterns — you're awake to yours.",
      "Growth happens in the space between who you were and who you're becoming. Today you occupied that space with intention.",
      "Every insight you capture here accelerates the next one. You're building self-awareness like compound interest.",
    ])
  if (themes.includes('stress') && mentionsWork)
    return pick([
      "Work stress is real but temporary. Will this matter in 6 months? If yes, make a plan. If no, let it pass. Either way, you're handling more than you give yourself credit for.",
      "The pressure you're feeling means you care about doing good work. That's admirable — just make sure you're also caring for the person doing the work.",
    ])
  if (themes.includes('fear') || themes.includes('stress'))
    return pick([
      "Fear shows up loudest right before growth. It's trying to keep you safe by keeping you small. Notice it, acknowledge it, but don't let it drive.",
      "What you're feeling right now is temporary — but how you respond to it shapes what comes next. You're already doing the hard part by facing it.",
      "Stress is information, not a verdict. It's telling you something needs attention. The fact that you're writing about it means you're already processing it.",
    ])
  if (themes.includes('gratitude'))
    return pick([
      "Gratitude isn't just a nice feeling — it's a lens that changes what you see. The more you practice it, the more good you'll notice.",
      "What you appreciate appreciates. By writing this down, you're training your brain to find evidence of good — and it will.",
    ])
  if (themes.includes('joy'))
    return pick([
      "Joy is data. It tells you what lights you up and what's worth protecting in your life. Engineer more of whatever made today good.",
      "This is what alignment feels like. When your actions match your values, joy follows naturally. Notice what made this happen.",
    ])
  if (themes.includes('relationships') || mentionsPeople)
    return pick([
      "The quality of your life is shaped by the quality of your connections. You're investing in the right things.",
      "The people who matter most to you showed up in your thoughts today. That says something beautiful about your priorities.",
      "Connection is a choice you made today — not everyone makes it. The people in your life are lucky to have someone who pays this much attention.",
    ])
  if (mentionsHealth)
    return pick([
      "Taking care of your body is taking care of your future self. Every small choice compounds. You're building something.",
      "Health isn't a destination — it's a practice. And today, you practiced. That's what consistency looks like.",
    ])
  if (mood === 'rough' || mood === 'tough')
    return pick([
      "Hard days don't define you — they reveal what you're made of. You could have ignored your feelings, but you chose to face them. That takes real strength.",
      "Today was heavy, and that's okay. The bravest thing you can do is be honest about how you feel. You did that. Tomorrow is a new page.",
      "Some days are just hard. No silver lining needed. But the fact that you showed up to write about it? That's resilience in its purest form.",
    ])
  if (mood === 'great' || mood === 'good')
    return pick([
      "This is what a good day looks like for you. Notice what made it that way — the people, the energy, the choices. Good days aren't accidents.",
      "You're in a good place right now. Soak it in. These are the moments that fuel you through the harder ones.",
      "Something clicked today. Pay attention to what it was — because when you know what makes a day good, you can create more of them.",
    ])
  return pick([
    "You showed up for yourself today. That's the foundation everything else gets built on. Keep coming back.",
    "Every entry is a gift to your future self — context they'll need, perspective they'll appreciate, evidence they mattered.",
    "The simple act of writing is how you turn experiences into wisdom. Today's words will mean something different when you read them in a year.",
    "Not every day needs to be profound. Sometimes just capturing the ordinary is what makes your journal extraordinary over time.",
  ])
}

// ─── WEEKLY RECAP ───────────────────────────────────────────────────

function getWeeklyRecap(journal: JournalEntry[]) {
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const weekEntries = journal.filter(e => new Date(e.createdAt) >= weekAgo)
  if (weekEntries.length < 2) return null

  const themeCount: Record<string, number> = {}
  weekEntries.forEach(e => (e.themes || extractThemes(e.content)).forEach(t => { themeCount[t] = (themeCount[t] || 0) + 1 }))
  const topThemes = Object.entries(themeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, count }))

  const moodMap: Record<string, number> = { great: 5, good: 4, okay: 3, tough: 2, rough: 1 }
  const moodScores = weekEntries.filter(e => e.mood).map(e => moodMap[e.mood!] || 3)
  const avg = moodScores.length > 0 ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length : 3
  const moodAvg = avg >= 4 ? 'positive' : avg >= 3 ? 'neutral' : 'challenging'

  let coaching = ''
  if (topThemes.some(t => t.id === 'impact'))
    coaching = "You spent this week making a difference in other people's lives. That's not just work — that's legacy."
  else if (topThemes.some(t => t.id === 'stress') && topThemes.some(t => t.id === 'achievement'))
    coaching = "You're achieving a lot but carrying stress. The wins are real — but so is the toll. What can you delegate?"
  else if (topThemes.some(t => t.id === 'fear') || topThemes.some(t => t.id === 'stress'))
    coaching = "Heavy moments this week. That's awareness, not weakness. Your journal shows you're still showing up."
  else if (topThemes.some(t => t.id === 'growth') || topThemes.some(t => t.id === 'achievement'))
    coaching = "Your week was marked by growth and forward motion. This is momentum. Keep documenting."
  else if (topThemes.some(t => t.id === 'relationships'))
    coaching = "Connection showed up as a major theme. The people in your life matter, and you're paying attention."
  else
    coaching = `${weekEntries.length} entries this week. That consistency builds self-awareness. The patterns will become clearer.`

  return { entries: weekEntries, themes: topThemes, moodAvg, coaching }
}

// ─── COMPONENT ─────────────────────────────────────────────────────

export function JournalView({ state, addJournalEntry, deleteJournalEntry, updateJournalEntry }: Props) {
  const [view, setView] = useState<'home' | 'write' | 'saved' | 'recap' | 'edit' | 'read'>('home')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<JournalEntry['mood']>(undefined)
  const [currentPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])
  const [justSaved, setJustSaved] = useState<JournalEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [readingEntry, setReadingEntry] = useState<JournalEntry | null>(null)
  
  // ─── VOICE RECORDING ─────────────────────────────────
  // Android Chrome kills continuous recognition after ~5s and restarts can replay
  // old audio. We deduplicate using a Set of seen transcript fingerprints.
  // iOS Safari handles continuous mode properly but we use the same safe approach.
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const stoppedByUserRef = useRef(false)
  const textBeforeVoiceRef = useRef('')
  const finalSegmentsRef = useRef<string[]>([])
  const seenFinalsRef = useRef<Set<string>>(new Set())
  const processedIdxRef = useRef(0)
  const restartTimeoutRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true
      try { recognitionRef.current?.abort() } catch {}
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('action') === 'journal-voice') {
        setView('write')
        setTimeout(() => startVoice(), 600)
        window.history.replaceState({}, '', '/')
      }
    } catch {}
  }, [])

  const buildDisplayText = (interim: string = '') => {
    const parts = [textBeforeVoiceRef.current, ...finalSegmentsRef.current]
    if (interim) parts.push(interim)
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }

  const STOP_COMMANDS = ['stop recording and save', 'stop recording', 'done recording', "i'm done", 'save entry', 'stop and save']

  const checkVoiceCommand = (text: string): boolean => {
    const lower = text.toLowerCase().trim()
    return STOP_COMMANDS.some(cmd => lower.endsWith(cmd))
  }

  const removeStopCommand = () => {
    if (finalSegmentsRef.current.length === 0) return
    const lastIdx = finalSegmentsRef.current.length - 1
    let last = finalSegmentsRef.current[lastIdx]
    const lower = last.toLowerCase()
    for (const cmd of STOP_COMMANDS) {
      const idx = lower.lastIndexOf(cmd)
      if (idx !== -1) {
        finalSegmentsRef.current[lastIdx] = last.substring(0, idx).trim()
        if (!finalSegmentsRef.current[lastIdx]) finalSegmentsRef.current.pop()
        return
      }
    }
  }

  const doStopAndSave = () => {
    stoppedByUserRef.current = true
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
    try { recognitionRef.current?.stop() } catch {}
    setIsListening(false)
    removeStopCommand()
    const finalText = buildDisplayText()
    setContent(finalText)
    if (finalText.trim()) {
      setTimeout(() => {
        const btn = document.querySelector('[data-save-btn]') as HTMLButtonElement
        if (btn) btn.click()
      }, 400)
    }
  }

  const launchRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    const isAndroid = /android/i.test(navigator.userAgent)
    rec.continuous = !isAndroid  // Android: false to prevent duplication
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => setIsListening(true)

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = processedIdxRef.current; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript.trim()
          if (!transcript) { processedIdxRef.current = i + 1; continue }
          const fp = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
          if (fp && !seenFinalsRef.current.has(fp)) {
            seenFinalsRef.current.add(fp)
            finalSegmentsRef.current.push(transcript)
          }
          processedIdxRef.current = i + 1
          
          if (checkVoiceCommand(buildDisplayText())) {
            doStopAndSave()
            return
          }
        } else {
          interim = e.results[i][0].transcript
        }
      }
      setContent(buildDisplayText(interim))
    }

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      console.warn('Voice error:', e.error)
    }

    rec.onend = () => {
      if (!stoppedByUserRef.current) {
        const isAndroid = /android/i.test(navigator.userAgent)
        if (isAndroid) {
          // Android: stop cleanly. Text preserved. User taps mic to continue.
          setIsListening(false)
          setContent(buildDisplayText())
        } else {
          // iOS: restart seamlessly
          processedIdxRef.current = 0
          restartTimeoutRef.current = setTimeout(() => {
            if (!stoppedByUserRef.current) launchRecognition()
            else setIsListening(false)
          }, 500)
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
    try { rec.start() } catch { setIsListening(false) }
  }

  const startVoice = () => {
    textBeforeVoiceRef.current = content.trim()
    finalSegmentsRef.current = []
    seenFinalsRef.current = new Set()
    processedIdxRef.current = 0
    stoppedByUserRef.current = false
    try { recognitionRef.current?.abort() } catch {}
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
    launchRecognition()
  }

  const stopVoice = () => {
    stoppedByUserRef.current = true
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
    try { recognitionRef.current?.stop() } catch {}
    setIsListening(false)
    setContent(buildDisplayText())
  }

  const toggleVoice = () => {
    if (isListening) { stopVoice() } else { startVoice() }
  }


  // ─── SAVE ───────────────────────────────────────────
  const handleSave = () => {
    if (!content.trim()) return

    // Stop voice if recording
    if (isListening) stopVoice()

    // Check journal limit for free tier
    const tier = state.subscription?.tier || 'free'
    const maxEntries = tier === 'free' ? 5 : Infinity
    const thisMonth = new Date().getMonth()
    const thisYear = new Date().getFullYear()
    const thisMonthEntries = state.journal.filter(e => {
      const d = new Date(e.createdAt)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length
    if (thisMonthEntries >= maxEntries) {
      alert(`You've used your ${maxEntries} journal entries this month. Upgrade for unlimited journaling — tap the 👑 icon.`)
      return
    }

    const themes = extractThemes(content)
    const reflection = getAIReflection(content, mood, themes)
    const entry: JournalEntry = {
      id: uid(),
      content: content.trim(),
      mood,
      createdAt: new Date().toISOString(),
      aiReflection: reflection,
      themes,
    }
    addJournalEntry(entry)
    setJustSaved(entry)
    setContent('')
    setMood(undefined)
    setView('saved')
  }

  // ─── EDIT ───────────────────────────────────────────
  const handleStartEdit = (entry: JournalEntry) => {
    setEditingEntry(entry)
    setContent(entry.content)
    setMood(entry.mood)
    setView('edit')
  }

  const handleSaveEdit = () => {
    if (!editingEntry || !content.trim()) return
    const themes = extractThemes(content)
    const reflection = getAIReflection(content, mood, themes)
    updateJournalEntry(editingEntry.id, {
      content: content.trim(),
      mood,
      themes,
      aiReflection: reflection,
    })
    setContent('')
    setMood(undefined)
    setEditingEntry(null)
    setView('home')
  }

  // ─── DELETE ─────────────────────────────────────────
  const handleDelete = (id: string) => {
    if (confirm('Delete this journal entry? This cannot be undone.')) {
      deleteJournalEntry(id)
    }
  }

  // Filter entries
  const filteredEntries = searchQuery.trim()
    ? state.journal.filter(e => e.content.toLowerCase().includes(searchQuery.toLowerCase()) || (e.themes || []).some(t => getThemeConfig(t)?.label.toLowerCase().includes(searchQuery.toLowerCase())))
    : state.journal

  // Get all themes across all entries
  const allThemes: Record<string, number> = {}
  state.journal.forEach(e => (e.themes || extractThemes(e.content)).forEach(t => { allThemes[t] = (allThemes[t] || 0) + 1 }))
  const topThemes = Object.entries(allThemes).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const recap = getWeeklyRecap(state.journal)

  // ─── READ VIEW (tap to read full entry) ─────────────
  if (view === 'read' && readingEntry) {
    const themes = readingEntry.themes || extractThemes(readingEntry.content)
    return (
      <div className="px-4 py-4">
        <button onClick={() => { setView('home'); setReadingEntry(null) }}
          className="text-sm text-stone-600 mb-4">← Back to journal</button>

        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {readingEntry.mood && <span className="text-2xl">{MOODS.find(m => m.value === readingEntry.mood)?.emoji}</span>}
              <span className="text-sm text-stone-500">
                {new Date(readingEntry.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <p className="text-[15px] text-stone-800 leading-relaxed whitespace-pre-wrap">{readingEntry.content}</p>
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Themes</p>
            <div className="flex flex-wrap gap-1.5">
              {themes.map(t => {
                const cfg = getThemeConfig(t)
                return cfg ? <span key={t} className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.emoji} {cfg.label}</span> : null
              })}
            </div>
          </div>
        )}

        {/* AI Reflection */}
        {readingEntry.aiReflection && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 mb-5">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">LifePilot's reflection</p>
            <p className="text-sm text-indigo-800 leading-relaxed italic">"{readingEntry.aiReflection}"</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => handleStartEdit(readingEntry)}
            className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 text-sm font-medium flex items-center justify-center gap-2">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button onClick={() => { handleDelete(readingEntry.id); setView('home'); setReadingEntry(null) }}
            className="py-3 px-5 rounded-xl bg-red-50 text-red-500 text-sm font-medium flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    )
  }

  // ─── SAVED VIEW ──────────────────────────────────────
  if (view === 'saved' && justSaved) {
    const themes = justSaved.themes || extractThemes(justSaved.content)
    return (
      <div className="px-4 py-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-indigo-500" />
          </div>
          <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Entry saved</h2>
        </div>
        {themes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Themes detected</p>
            <div className="flex flex-wrap gap-1.5">
              {themes.map(t => {
                const cfg = getThemeConfig(t)
                return cfg ? <span key={t} className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.emoji} {cfg.label}</span> : null
              })}
            </div>
          </div>
        )}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 mb-6">
          <p className="text-sm text-indigo-800 leading-relaxed italic">"{justSaved.aiReflection}"</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-2">
            {justSaved.mood && <span className="text-lg">{MOODS.find(m => m.value === justSaved.mood)?.emoji}</span>}
            <span className="text-xs text-stone-600">{new Date(justSaved.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">{justSaved.content}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setContent(''); setView('write') }} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">Write another</button>
          <button onClick={() => setView('home')} className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 text-sm font-medium">Back to journal</button>
        </div>
      </div>
    )
  }

  // ─── WRITE / EDIT VIEW ─────────────────────────────────
  if (view === 'write' || view === 'edit') {
    return (
      <div className="px-4 py-4 flex flex-col h-full">
        <button onClick={() => { setView('home'); setContent(''); setMood(undefined); setEditingEntry(null); if (isListening) stopVoice() }}
          className="text-sm text-stone-600 mb-3 self-start">← Back</button>

        <div className="bg-amber-50/50 rounded-xl p-3 mb-3 border border-amber-100/50">
          <p className="text-sm text-amber-700">💭 {currentPrompt}</p>
        </div>

        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">How are you feeling?</p>
        <div className="flex gap-2 mb-3">
          {MOODS.map(m => (
            <button key={m.value} onClick={() => setMood(m.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all ${mood === m.value ? 'border-amber-400 bg-amber-50' : 'border-stone-100 bg-white'}`}>
              <span className="text-xl">{m.emoji}</span>
              <span className="text-xs text-stone-600">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Voice recording indicator */}
        {isListening && (
          <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm text-red-600 font-medium">Recording...</p>
              <p className="text-xs text-red-500">Say "stop recording and save" or tap Stop</p>
            </div>
            <button onClick={stopVoice} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg">Stop</button>
          </div>
        )}

        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write or speak what's on your mind..."
          className="flex-1 min-h-[180px] resize-none text-[15px] leading-relaxed border-stone-200 focus-visible:ring-indigo-300 rounded-xl p-4"
        />

        <div className="flex gap-3 mt-3">
          {hasFeature(state.subscription.tier, 'voice_journal') ? (
            <button onClick={toggleVoice}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : (
            <button onClick={() => alert('Voice journal is available on the Life Pilot plan and above. Tap the 👑 icon to upgrade.')}
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-stone-50 text-stone-300 relative">
              <Mic className="w-5 h-5" />
              <Lock className="w-3 h-3 absolute -top-0.5 -right-0.5 text-amber-500" />
            </button>
          )}
          <button
            data-save-btn
            onClick={view === 'edit' ? handleSaveEdit : handleSave}
            disabled={!content.trim()}
            className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-indigo-700">
            {view === 'edit' ? 'Save changes' : 'Save & reflect ✨'}
          </button>
        </div>
      </div>
    )
  }

  // ─── RECAP VIEW ─────────────────────────────────────────
  if (view === 'recap' && recap) {
    const totalThemeCount = recap.themes.reduce((sum, t) => sum + t.count, 0)
    return (
      <div className="px-4 py-4">
        <button onClick={() => setView('home')} className="text-sm text-stone-600 mb-4">← Back</button>
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Weekly Recap</h2>
          <p className="text-xs text-stone-600">{recap.entries.length} entries · Mood: {recap.moodAvg}</p>
        </div>

        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Top themes this week</p>
        <div className="space-y-2 mb-5">
          {recap.themes.map(({ id, count }) => {
            const cfg = getThemeConfig(id)
            if (!cfg) return null
            const pct = Math.round((count / totalThemeCount) * 100)
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="text-sm w-6">{cfg.emoji}</span>
                <span className="text-xs text-stone-700 flex-1">{cfg.label}</span>
                <div className="w-20 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-stone-500 w-12 text-right">{count}× ({pct}%)</span>
              </div>
            )
          })}
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5 mb-5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Coach's note</p>
          <p className="text-sm text-amber-900 leading-relaxed">{recap.coaching}</p>
        </div>

        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Entries this week</p>
        <div className="space-y-2">
          {recap.entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-lg border border-stone-100 p-3 text-xs text-stone-600">
              <span className="text-stone-600 mr-2">{new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              {entry.content.substring(0, 80)}{entry.content.length > 80 ? '...' : ''}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── HOME VIEW ──────────────────────────────────────────
  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-stone-800 mb-1" style={{ fontFamily: "'Georgia', serif" }}>Journal</h2>
        <p className="text-sm text-stone-600">Your space to think, process, and see yourself clearly</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => setView('write')}
          className="flex-1 flex items-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
          <BookOpen className="w-5 h-5 text-white/80" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Write</p>
            <p className="text-xs text-white/70">Type your thoughts</p>
          </div>
        </button>
        <button onClick={() => { setView('write'); setTimeout(() => startVoice(), 400) }}
          className="flex-1 flex items-center gap-3 bg-gradient-to-r from-rose-400 to-pink-500 rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
          <Mic className="w-5 h-5 text-white/80" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Speak</p>
            <p className="text-xs text-white/70">Record your voice</p>
          </div>
        </button>
      </div>

      {/* Weekly recap banner */}
      {recap && hasFeature(state.subscription.tier, 'weekly_recaps') && (
        <button onClick={() => setView('recap')}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3.5 mb-4 hover:shadow-sm transition-all">
          <TrendingUp className="w-5 h-5 text-amber-500 flex-none" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-amber-800">Weekly Recap Ready</p>
            <p className="text-xs text-amber-600">{recap.entries.length} entries · {recap.themes.length} themes</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search entries or themes..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 text-sm bg-white" />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-stone-600" />
          </button>
        )}
      </div>

      {/* Theme tags */}
      {topThemes.length > 0 && !searchQuery && hasFeature(state.subscription.tier, 'theme_detection') && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 px-0.5">Your themes</p>
          <div className="flex flex-wrap gap-1.5">
            {topThemes.map(([id, count]) => {
              const cfg = getThemeConfig(id)
              return cfg ? (
                <button key={id} onClick={() => setSearchQuery(cfg.label)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} hover:opacity-80 transition-opacity`}>
                  {cfg.emoji} {cfg.label} ({count})
                </button>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Entries */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">{searchQuery ? '🔍' : '📝'}</p>
          <p className="text-sm text-stone-600 max-w-xs mx-auto">
            {searchQuery ? `No entries matching "${searchQuery}"` : "Your journal is waiting. Write what happened today — the wins, the struggles, the quiet moments. Over time, you'll see patterns, build self-awareness, and have a record of who you really are."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchQuery && <p className="text-xs text-stone-500">{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</p>}
          {filteredEntries.map(entry => {
            const themes = entry.themes || extractThemes(entry.content)
            return (
              <div key={entry.id} className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm cursor-pointer hover:border-stone-200 transition-colors"
                onClick={() => { setReadingEntry(entry); setView('read') }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {entry.mood && <span className="text-lg">{MOODS.find(m => m.value === entry.mood)?.emoji}</span>}
                    <span className="text-xs text-stone-600">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Edit & Delete buttons */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleStartEdit(entry)} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-stone-600" />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-stone-600 hover:text-red-500" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed mb-2 line-clamp-3">{entry.content}</p>
                {/* Theme tags */}
                {themes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {themes.map(t => {
                      const cfg = getThemeConfig(t)
                      return cfg ? <span key={t} className={`px-2 py-0.5 rounded-full text-xs ${cfg.color}`}>{cfg.emoji} {cfg.label}</span> : null
                    })}
                  </div>
                )}
                {entry.aiReflection && (
                  <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100/50">
                    <p className="text-xs text-indigo-600 leading-relaxed italic">✨ {entry.aiReflection}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

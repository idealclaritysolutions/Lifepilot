import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AppState, JournalEntry } from '@/App'
import { hasFeature } from '@/App'
import { uid } from '@/lib/ai-engine'
import { BookOpen, ChevronRight, Sparkles, Mic, MicOff, Search, X, TrendingUp, Calendar, Trash2, Pencil, Lock, Volume2, VolumeX } from 'lucide-react'

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
  { id: 'faith', label: 'Faith & Spirituality', emoji: '🕊️', color: 'bg-sky-50 text-sky-700', patterns: /faith|pray|prayer|god|church|worship|spirit(ual)?|bible|scripture|believ(e|ing) in|trust(ing)? (god|the lord|him)|sermon|devotion|bless(ed|ing)|miracle|grace|amen|soul|divine|meditat(e|ion)|thankful to god|higher power|purpose/i },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦', color: 'bg-amber-50 text-amber-700', patterns: /family|mom|dad|mother|father|parent|brother|sister|sibling|son |daughter|child|children|kid(s)?|grandma|grandpa|grandparent|uncle|aunt|cousin|nephew|niece|household|home life|family time|dinner together|game night/i },
  { id: 'love', label: 'Love & Romance', emoji: '💕', color: 'bg-rose-50 text-rose-600', patterns: /love (you|her|him|my|them)|in love|romantic|romance|dating|date night|relationship|partner|soulmate|heart|affection|intimacy|miss (you|her|him)|valentine|anniversary|wedding|engagement|crush|attracted|chemistry|spark|together forever/i },
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

// Generate bullet point summary of journal entry
// Quick client-side summary (instant, shown immediately)
function quickSummary(content: string): string[] {
  if (content.length < 80) return ['Brief entry captured.']
  return ['Generating AI summary...']
}

// AI-powered summary via API (called async after save)
async function generateAISummary(content: string, title?: string): Promise<string[]> {
  try {
    const titleContext = title ? `\nTitle: "${title}"` : ''
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `You are summarizing a personal journal entry FOR the person who wrote it. They will read this summary later to quickly remember what they wrote about.

RULES:
- Write 2-5 bullet points in FIRST PERSON ("I..." not "The user..." or "They...")
- Each bullet must reference SPECIFIC details from the entry: names of places, people, things, events, decisions, amounts, feelings
- Do NOT be vague or generic. Do NOT interpret hidden emotions or psychoanalyze. Just capture what actually happened and what I actually said/felt.
- Keep each bullet under 25 words
- If I mentioned a specific place, person, food, event, or experience — it MUST appear in the summary
- The tone should sound like me quickly jotting down notes to remember this day
- Return ONLY the bullet points, one per line, starting each with "•". No preamble, no analysis, no advice.

BAD example (too vague, third person):
• Experiences genuine awe at engineering marvels
• Notices tension between luxury and cost

GOOD example (specific, first person):
• I arrived in Miami and checked into the hotel
• Had dinner at CasaNeo by the water — good food but expensive
• Saw a drawbridge open for a ship — absolutely incredible to watch

Journal entry:
${content}` }],
        system: 'You summarize journal entries in first person, preserving specific names, places, events, and feelings. You are concise, personal, and specific. Never psychoanalyze or interpret hidden meanings. Just capture what happened.',
      }),
    })
    const data = await res.json()
    let text = ''
    if (data.content && Array.isArray(data.content)) {
      text = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    } else if (typeof data.response === 'string') {
      text = data.response
    } else if (typeof data.message === 'string') {
      text = data.message
    }
    if (!text) return ['Entry captured.']
    const bullets = text.split('\n').map((l: string) => l.replace(/^[•\-\*\d+\.]\s*/, '').trim()).filter((l: string) => l.length > 10)
    return bullets.length > 0 ? bullets.slice(0, 5) : ['Entry captured.']
  } catch (err) {
    console.error('[Journal] Summary error:', err)
    return ['Entry captured.']
  }
}

// Curated theme list for manual add
const ALL_THEMES = THEME_DEFS.map(t => ({ id: t.id, label: t.label, emoji: t.emoji, color: t.color }))

// AI-powered reflection that actually responds to what was written
async function generateAIReflection(content: string, mood: JournalEntry['mood'], themes: string[]): Promise<string> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `You are a warm, thoughtful journaling companion. The user just wrote a journal entry. Write a SHORT personal reflection (1-3 sentences max) that:

1. DIRECTLY references something specific they wrote about — a place, person, event, feeling, or decision they mentioned
2. Adds a warm, encouraging observation or gentle insight connected to THEIR specific experience
3. Feels like a caring friend responding to what they shared, NOT a therapist or life coach
4. Never uses corporate language, clichés, or generic motivational quotes
5. If they described something fun or beautiful, celebrate it with them
6. If they described something hard, acknowledge the specific difficulty without preaching
7. Keep it conversational — like a text from a close friend who really listened

Their mood: ${mood || 'neutral'}
Themes detected: ${themes.join(', ') || 'none'}

BAD example (generic, preachy):
"Leadership isn't about having all the answers. It's about being willing to go first."

GOOD example (specific, warm):
"CasaNeo by the water sounds amazing — and that drawbridge moment? Those are the kind of unexpected wonders that make a trip unforgettable. What a day."

Journal entry:
${content}

Return ONLY the reflection text. No quotes, no labels, no preamble.` }],
        system: 'You write warm, specific, personal reflections on journal entries. You reference exact details from the entry. You sound like a caring friend, never a therapist or motivational speaker.',
      }),
    })
    const data = await res.json()
    let text = ''
    if (data.content && Array.isArray(data.content)) {
      text = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')
    } else if (typeof data.response === 'string') {
      text = data.response
    } else if (typeof data.message === 'string') {
      text = data.message
    }
    return text?.trim() || getFallbackReflection(content, mood)
  } catch {
    return getFallbackReflection(content, mood)
  }
}

// Simple fallback if AI call fails
function getFallbackReflection(content: string, mood: JournalEntry['mood']): string {
  if (mood === 'great' || mood === 'good') return "Sounds like a day worth remembering. Glad you captured it."
  if (mood === 'rough' || mood === 'tough') return "Not every day is easy. Writing about it is a strong move."
  return "Thanks for showing up today. Every entry adds up."
}

// Legacy wrapper for sync calls during save (returns placeholder, replaced by AI async)
function getAIReflection(content: string, mood: JournalEntry['mood'], themes: string[]): string {
  return getFallbackReflection(content, mood)
}

// AI title generation for entries without a user-provided title
async function generateAITitle(content: string): Promise<string> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Generate a short, memorable title (3-8 words) for this journal entry. The title should capture the essence of what happened — like a chapter name in a book about my life. Use first person if natural. No quotes around it, no period at the end, no generic titles like "A Good Day" or "Daily Reflection" or "Thoughts and Feelings". Be specific to the actual content — mention places, people, or events if they appear.\n\nExamples of GOOD titles:\n- Miami, Drawbridges, and Expensive Dinner\n- The Day I Finally Said Yes\n- Rain, Coffee, and a Long Overdue Call\n- First Week at the New Gig\n\nExamples of BAD titles:\n- A Day of Reflection\n- Thoughts on Life\n- My Journey Continues\n- Daily Entry\n\nJournal entry:\n${content}` }],
        system: 'Generate a single short journal title. 3-8 words. No quotes. Specific to the content. Return ONLY the title text, nothing else.',
      }),
    })
    const data = await res.json()
    let text = ''
    if (data.content && Array.isArray(data.content)) {
      text = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    } else if (typeof data.response === 'string') {
      text = data.response
    } else if (typeof data.message === 'string') {
      text = data.message
    }
    const cleaned = text?.trim().replace(/^["']|["']$/g, '').replace(/\.+$/, '').substring(0, 80)
    return cleaned || 'Untitled Entry'
  } catch {
    return 'Untitled Entry'
  }
}

// AI-powered voice transcript cleanup: removes fillers, duplicates, corrects errors
async function cleanTranscriptWithAI(text: string): Promise<string> {
  if (text.trim().length < 30) return text
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Clean up this voice-to-text journal transcript. Your job:\n1. Remove filler words: um, uh, hmm, ah, er, "like" (when used as a filler), "you know", "I mean"\n2. Remove repeated words and phrases caused by speech recognition (e.g. "I I went" → "I went", "the the store" → "the store")\n3. Fix obvious speech-to-text errors and auto-correct misspelled or misheard words intelligently\n4. Do NOT change the meaning, add new content, or rewrite sentences — just clean what's there\n5. Keep the writer's personal voice and casual tone exactly as-is\n\nReturn ONLY the cleaned text. No preamble, no explanation, no quotes around it.\n\nTranscript:\n${text}` }],
        system: 'You clean voice-to-text transcripts. Remove filler words and repetitions, fix speech recognition errors. Never alter meaning or add content. Return only the cleaned text.',
      }),
    })
    const data = await res.json()
    let cleaned = ''
    if (data.content && Array.isArray(data.content)) {
      cleaned = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    } else if (typeof data.response === 'string') {
      cleaned = data.response
    } else if (typeof data.message === 'string') {
      cleaned = data.message
    }
    return cleaned?.trim() || text
  } catch {
    return text
  }
}

// Instant client-side cleaning applied to each speech segment in real time
function cleanSegmentInstant(text: string): string {
  if (!text) return text
  // Remove standalone filler words
  let cleaned = text.replace(/\b(um+|uh+|er+|hmm+|mhm+|ah+)\b[\s,]*/gi, ' ')
  // Remove immediately consecutive duplicate words: "I I went" → "I went"
  cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/gi, '$1')
  // Remove consecutive duplicate 2-word phrases: "went to went to" → "went to"
  cleaned = cleaned.replace(/\b(\w+ \w+)\s+\1\b/gi, '$1')
  return cleaned.replace(/\s+/g, ' ').trim()
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
  const [title, setTitle] = useState('')
  const [showDuplicates, setShowDuplicates] = useState(false)
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
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false)
  const [speakingTarget, setSpeakingTarget] = useState<'summary' | 'entry' | null>(null)
  const ttsRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true
      try { recognitionRef.current?.abort() } catch {}
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
      try { window.speechSynthesis?.cancel() } catch {}
    }
  }, [])

  // Stop TTS whenever the view changes
  useEffect(() => {
    try { window.speechSynthesis?.cancel() } catch {}
    setSpeakingTarget(null)
  }, [view])

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

  // Smart punctuation: capitalize after pauses, add periods at natural breaks
  const addSmartPunctuation = (text: string): string => {
    if (!text) return text
    // Capitalize first letter
    let result = text.charAt(0).toUpperCase() + text.slice(1)
    // Add periods before common sentence starters if missing punctuation
    result = result.replace(/([a-z]) (I |So |Then |But |And then |After |Also |However |Today |Tomorrow |Yesterday |This |That |My |We |They |He |She |It was |The )/g, '$1. $2')
    // Capitalize after periods, exclamation, question marks
    result = result.replace(/([.!?])\s+([a-z])/g, (_, p, c) => p + ' ' + c.toUpperCase())
    // Add period at end if missing
    if (result.length > 10 && !/[.!?]$/.test(result.trim())) result = result.trim() + '.'
    return result
  }

  const buildDisplayText = (interim: string = '') => {
    const parts = [textBeforeVoiceRef.current, ...finalSegmentsRef.current]
    if (interim) parts.push(interim)
    const raw = parts.join(' ').replace(/\s+/g, ' ').trim()
    return addSmartPunctuation(raw)
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
    rec.continuous = !isAndroid  // Android: false prevents duplication. iOS: true for smooth recording.
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => setIsListening(true)

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = processedIdxRef.current; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = cleanSegmentInstant(e.results[i][0].transcript.trim())
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
    const rawText = buildDisplayText()
    setContent(rawText)
    // Silently polish transcript with AI in background
    if (rawText.trim().length > 20) {
      setIsCleaningTranscript(true)
      cleanTranscriptWithAI(rawText).then(cleaned => {
        setContent(cleaned)
        setIsCleaningTranscript(false)
      })
    }
  }

  const toggleVoice = () => {
    if (isListening) { stopVoice() } else { startVoice() }
  }

  // ─── TEXT-TO-SPEECH ──────────────────────────────────
  const speak = (text: string, target: 'summary' | 'entry') => {
    if (!window.speechSynthesis) return
    if (speakingTarget === target) {
      window.speechSynthesis.cancel()
      setSpeakingTarget(null)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.onend = () => setSpeakingTarget(null)
    utterance.onerror = () => setSpeakingTarget(null)
    ttsRef.current = utterance
    setSpeakingTarget(target)
    window.speechSynthesis.speak(utterance)
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
      title: title.trim() || undefined,
      content: content.trim(),
      mood,
      createdAt: new Date().toISOString(),
      aiReflection: reflection,
      themes,
      summary: quickSummary(content),
    }
    addJournalEntry(entry)
    setJustSaved(entry)
    setContent('')
    setTitle('')
    setMood(undefined)
    setView('saved')
    
    // Fetch real AI summary AND reflection in background
    const trimmedContent = content.trim()
    const entryTitle = title.trim()
    generateAISummary(trimmedContent, entryTitle).then(aiSummary => {
      updateJournalEntry(entry.id, { summary: aiSummary })
      setJustSaved(prev => prev ? { ...prev, summary: aiSummary } : prev)
    })
    generateAIReflection(trimmedContent, mood, themes).then(aiReflection => {
      updateJournalEntry(entry.id, { aiReflection })
      setJustSaved(prev => prev ? { ...prev, aiReflection } : prev)
    })
    // Generate AI title if user didn't provide one
    if (!entryTitle) {
      generateAITitle(trimmedContent).then(aiTitle => {
        updateJournalEntry(entry.id, { title: aiTitle })
        setJustSaved(prev => prev ? { ...prev, title: aiTitle } : prev)
      })
    }
  }

  // ─── EDIT ───────────────────────────────────────────
  const handleStartEdit = (entry: JournalEntry) => {
    setEditingEntry(entry)
    setContent(entry.content)
    setTitle(entry.title || '')
    setMood(entry.mood)
    setView('edit')
  }

  const handleSaveEdit = () => {
    if (!editingEntry || !content.trim()) return
    const themes = extractThemes(content)
    const reflection = getAIReflection(content, mood, themes)
    const entryTitle = title.trim()
    updateJournalEntry(editingEntry.id, {
      title: entryTitle || editingEntry.title,
      content: content.trim(),
      mood,
      themes,
      summary: quickSummary(content),
      aiReflection: reflection,
    })
    const editId = editingEntry.id
    const trimmed = content.trim()
    setContent('')
    setTitle('')
    setMood(undefined)
    setEditingEntry(null)
    setView('home')
    // Fetch AI summary AND reflection in background
    generateAISummary(trimmed, entryTitle).then(aiSummary => {
      updateJournalEntry(editId, { summary: aiSummary })
    })
    generateAIReflection(trimmed, mood, themes).then(aiReflection => {
      updateJournalEntry(editId, { aiReflection })
    })
    // Generate title if still missing
    if (!entryTitle && !editingEntry.title) {
      generateAITitle(trimmed).then(aiTitle => {
        updateJournalEntry(editId, { title: aiTitle })
      })
    }
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
    const summary = readingEntry.summary && readingEntry.summary[0] !== 'Generating AI summary...' ? readingEntry.summary : null
    // Auto-generate summary for old entries that don't have one
    if (!summary && readingEntry.content.length > 80) {
      generateAISummary(readingEntry.content).then(aiSummary => {
        updateJournalEntry(readingEntry.id, { summary: aiSummary })
        setReadingEntry(prev => prev ? { ...prev, summary: aiSummary } : prev)
      })
    }
    // Auto-generate reflection for old entries or ones with placeholder reflections
    const hasRealReflection = readingEntry.aiReflection && readingEntry.aiReflection.length > 60 && !readingEntry.aiReflection.startsWith('Sounds like') && !readingEntry.aiReflection.startsWith('Not every day') && !readingEntry.aiReflection.startsWith('Thanks for showing')
    if (!hasRealReflection && readingEntry.content.length > 80) {
      generateAIReflection(readingEntry.content, readingEntry.mood, themes).then(aiReflection => {
        updateJournalEntry(readingEntry.id, { aiReflection })
        setReadingEntry(prev => prev ? { ...prev, aiReflection } : prev)
      })
    }
    // Auto-generate title for old entries that don't have one
    if (!readingEntry.title && readingEntry.content.length > 40) {
      generateAITitle(readingEntry.content).then(aiTitle => {
        updateJournalEntry(readingEntry.id, { title: aiTitle })
        setReadingEntry(prev => prev ? { ...prev, title: aiTitle } : prev)
      })
    }
    return (
      <div className="px-4 py-4">
        <button onClick={() => { setView('home'); setReadingEntry(null); setShowDuplicates(false) }}
          className="text-sm text-stone-600 mb-4">← Back to journal</button>

        {/* Title */}
        {readingEntry.title && (
          <h2 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>{readingEntry.title}</h2>
        )}

        {/* Date and mood header */}
        <div className="flex items-center gap-2 mb-4">
          {readingEntry.mood && <span className="text-2xl">{MOODS.find(m => m.value === readingEntry.mood)?.emoji}</span>}
          <span className="text-sm text-stone-500">
            {new Date(readingEntry.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {/* AI Summary — shown first for quick scanning */}
        {summary && summary.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Summary</p>
              <button onClick={() => speak(summary.join('. '), 'summary')}
                className={`p-1.5 rounded-lg transition-all ${speakingTarget === 'summary' ? 'bg-indigo-100 text-indigo-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}
                title={speakingTarget === 'summary' ? 'Stop reading' : 'Read summary aloud'}>
                {speakingTarget === 'summary' ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="bg-amber-50/50 rounded-xl border border-amber-100/50 p-4 space-y-2">
              {summary.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 text-xs">●</span>
                  <p className="text-sm text-stone-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Themes */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Themes <span className="normal-case font-normal text-stone-400">— tap to remove</span></p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {themes.map(t => {
              const cfg = getThemeConfig(t)
              return cfg ? (
                <button key={t} onClick={() => {
                  const updated = themes.filter(th => th !== t)
                  updateJournalEntry(readingEntry.id, { themes: updated })
                  setReadingEntry({ ...readingEntry, themes: updated })
                }} className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} hover:opacity-70`}>
                  {cfg.emoji} {cfg.label} ✕
                </button>
              ) : null
            })}
          </div>
          <ThemeAdder currentThemes={themes} onAdd={(themeId) => {
            const updated = [...themes, themeId]
            updateJournalEntry(readingEntry.id, { themes: updated })
            setReadingEntry({ ...readingEntry, themes: updated })
          }} />
        </div>

        {/* AI Reflection */}
        {readingEntry.aiReflection && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 mb-4">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Reflection</p>
            <p className="text-sm text-indigo-800 leading-relaxed italic">"{readingEntry.aiReflection}"</p>
          </div>
        )}

        {/* Full entry with duplicate detector */}
        <details open className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm mb-4">
          <summary className="text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer">Full Entry</summary>

          {/* Read aloud + Duplicate detector buttons */}
          <div className="flex justify-between items-center mt-2 mb-1">
            <button onClick={() => speak(readingEntry.content, 'entry')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${speakingTarget === 'entry' ? 'bg-indigo-100 text-indigo-600' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'}`}
              title={speakingTarget === 'entry' ? 'Stop reading' : 'Read entry aloud'}>
              {speakingTarget === 'entry' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {speakingTarget === 'entry' ? 'Stop reading' : 'Read aloud'}
            </button>
            <button onClick={() => setShowDuplicates(!showDuplicates)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                showDuplicates ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              {showDuplicates ? '✕ Hide duplicates' : '🔍 Find duplicates'}
            </button>
          </div>

          {showDuplicates ? (() => {
            // Split content into sentences and find duplicates
            const sentences = readingEntry.content
              .split(/(?<=[.!?])\s+|(?<=\n)/)
              .map(s => s.trim())
              .filter(s => s.length > 10)
            
            // Find duplicates (case-insensitive, ignoring minor whitespace differences)
            const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
            const seen = new Map<string, number[]>()
            sentences.forEach((s, i) => {
              const key = normalize(s)
              if (!seen.has(key)) seen.set(key, [])
              seen.get(key)!.push(i)
            })
            
            const duplicateKeys = new Set<string>()
            seen.forEach((indices, key) => { if (indices.length > 1) duplicateKeys.add(key) })
            
            const hasDuplicates = duplicateKeys.size > 0

            return (
              <div className="mt-2">
                {!hasDuplicates ? (
                  <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg p-3 text-center">✅ No duplicates found — this entry is clean!</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-amber-600 mb-2">{duplicateKeys.size} duplicate{duplicateKeys.size > 1 ? ' group' : ''} found. Tap a highlighted sentence to remove it.</p>
                    {sentences.map((sentence, idx) => {
                      const key = normalize(sentence)
                      const isDuplicate = duplicateKeys.has(key)
                      const indices = seen.get(key) || []
                      const isFirstOccurrence = isDuplicate && indices[0] === idx
                      const isRepeat = isDuplicate && !isFirstOccurrence

                      return (
                        <span key={idx}
                          onClick={() => {
                            if (isRepeat) {
                              // Remove this sentence from content
                              const newContent = readingEntry.content.replace(sentence, '').replace(/\s{2,}/g, ' ').replace(/\n\s*\n/g, '\n').trim()
                              updateJournalEntry(readingEntry.id, { content: newContent })
                              setReadingEntry(prev => prev ? { ...prev, content: newContent } : prev)
                            }
                          }}
                          className={`inline text-[15px] leading-relaxed ${
                            isRepeat
                              ? 'bg-red-100 text-red-700 rounded px-0.5 cursor-pointer hover:bg-red-200 hover:line-through transition-all'
                              : isFirstOccurrence
                              ? 'bg-amber-100 text-amber-800 rounded px-0.5'
                              : 'text-stone-800'
                          }`}
                          title={isRepeat ? 'Tap to remove this duplicate' : isFirstOccurrence ? 'First occurrence (kept)' : ''}>
                          {sentence}{' '}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })() : (
            <p className="text-[15px] text-stone-800 leading-relaxed whitespace-pre-wrap mt-3">{readingEntry.content}</p>
          )}
        </details>

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
    const summary = justSaved.summary || quickSummary(justSaved.content)
    return (
      <div className="px-4 py-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-indigo-500" />
          </div>
          <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Entry saved</h2>
          {justSaved.title && <p className="text-sm text-stone-500 mt-1">{justSaved.title}</p>}
        </div>

        {/* AI Summary */}
        {summary && summary.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Quick Summary</p>
              <button onClick={() => speak((justSaved.summary || []).join('. '), 'summary')}
                className={`p-1.5 rounded-lg transition-all ${speakingTarget === 'summary' ? 'bg-indigo-100 text-indigo-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}
                title={speakingTarget === 'summary' ? 'Stop reading' : 'Read summary aloud'}>
                {speakingTarget === 'summary' ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm space-y-2">
              {summary.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 text-xs">●</span>
                  <p className="text-sm text-stone-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Themes */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Themes <span className="normal-case font-normal text-stone-400">— tap to remove, or add below</span></p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {themes.map(t => {
              const cfg = getThemeConfig(t)
              return cfg ? (
                <button key={t} onClick={() => {
                  const updated = themes.filter(th => th !== t)
                  updateJournalEntry(justSaved.id, { themes: updated })
                  setJustSaved({ ...justSaved, themes: updated })
                }} className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} hover:opacity-70 transition-opacity`}>
                  {cfg.emoji} {cfg.label} ✕
                </button>
              ) : null
            })}
          </div>
          {/* Add theme picker */}
          <ThemeAdder currentThemes={themes} onAdd={(themeId) => {
            const updated = [...themes, themeId]
            updateJournalEntry(justSaved.id, { themes: updated })
            setJustSaved({ ...justSaved, themes: updated })
          }} />
        </div>

        {/* AI Reflection */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 mb-5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Reflection</p>
          <p className="text-sm text-indigo-800 leading-relaxed italic">"{justSaved.aiReflection}"</p>
        </div>

        {/* Original entry collapsed */}
        <details className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm mb-5">
          <summary className="text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer">Full Entry</summary>
          <div className="flex justify-end mt-2 mb-1">
            <button onClick={() => speak(justSaved.content, 'entry')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${speakingTarget === 'entry' ? 'bg-indigo-100 text-indigo-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}
              title={speakingTarget === 'entry' ? 'Stop reading' : 'Read entry aloud'}>
              {speakingTarget === 'entry' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {speakingTarget === 'entry' ? 'Stop' : 'Read aloud'}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 mb-2">
            {justSaved.mood && <span className="text-lg">{MOODS.find(m => m.value === justSaved.mood)?.emoji}</span>}
            <span className="text-xs text-stone-600">{new Date(justSaved.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">{justSaved.content}</p>
        </details>

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

        {/* AI transcript polishing indicator */}
        {isCleaningTranscript && (
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-xl border border-violet-100 mb-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-xs text-violet-600 font-medium">✨ Polishing your entry...</p>
          </div>
        )}

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional — AI will generate one if blank)"
          className="w-full px-4 py-2.5 text-base font-semibold text-stone-800 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-2"
          style={{ fontFamily: "'Georgia', serif" }}
        />

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
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {entry.mood && <span className="text-lg">{MOODS.find(m => m.value === entry.mood)?.emoji}</span>}
                    <span className="text-xs text-stone-500">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
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
                {/* Title */}
                {entry.title && (
                  <p className="text-sm font-semibold text-stone-800 mb-1" style={{ fontFamily: "'Georgia', serif" }}>{entry.title}</p>
                )}
                <p className="text-sm text-stone-600 leading-relaxed mb-2 line-clamp-2">{entry.content}</p>
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

// ─── THEME ADDER COMPONENT ──────────────────────────────────────

function ThemeAdder({ currentThemes, onAdd }: { currentThemes: string[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const available = ALL_THEMES.filter(t => !currentThemes.includes(t.id))
  
  if (available.length === 0) return null
  
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
        {open ? '— Close' : '+ Add a theme'}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
          {available.map(t => (
            <button key={t.id} onClick={() => { onAdd(t.id); if (available.length <= 1) setOpen(false) }}
              className={`px-2 py-0.5 rounded-full text-xs ${t.color} hover:ring-1 ring-current transition-all`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

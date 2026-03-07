import type { LifeItem, AppState } from '@/App'

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ─── ACTION TYPES ──────────────────────────────────────────────────

export interface AIAction {
  type: 'add_item' | 'update_item' | 'complete_item' | 'remove_item' | 'snooze_item' | 'add_multiple_items' | 'clear_completed' | 'add_person' | 'update_person' | 'add_event_to_person' | 'set_timer' | 'add_to_shared_list' | 'web_search' | 'add_habit' | 'complete_habit' | 'add_journal'
  payload: any
}

export interface AIResponse {
  message: string
  actions: AIAction[]
}

// ─── CATEGORY DETECTION ────────────────────────────────────────────

export function detectCategory(text: string): LifeItem['category'] {
  const t = text.toLowerCase()
  // Grocery list detection — items to buy at the store
  if (/grocery|groceries|grocery list|supermarket|whole foods|trader joe|aldi|kroger|publix/.test(t)) return 'grocery'
  if (/\b(buy|get|pick up|grab|need)\b.*(milk|eggs|bread|chicken|beef|fruit|vegetables|cheese|butter|rice|pasta|cereal|juice|water|yogurt|produce|snack|chips|frozen|canned)/.test(t)) return 'grocery'
  if (/dinner|lunch|breakfast|cook|recipe|meal|eat |food |fridge|chicken breast|salad|ingredients|prep/.test(t)) return 'meal'
  if (/gym|workout|exercise|supplement|vitamin|water intake|walk|run |medic|doctor|dentist|health|sleep|weight|pill|hydrat|stretch|yoga|meds|medication/.test(t)) return 'health'
  if (/bill|pay |money|bank|credit|insurance|subscription|budget|rent|mortgage|tax|price|cost|spend|save |invest/.test(t)) return 'finance'
  if (/clean|fix|repair|filter|mow|laundry|organize|declutter|house|home|plumb|hvac|maintenance|garage|trash|dishes/.test(t)) return 'home'
  if (/kid|child|school|permission|pickup|daycare|parent|family|spouse|partner|birthday|gift|anniversary|mom |dad /.test(t)) return 'family'
  if (/buy |shop|return|order|pickup|store|amazon|target|walmart|errand|appointment|schedule|book |renew/.test(t)) return 'errand'
  return 'general'
}

export const CATEGORY_CONFIG: Record<LifeItem['category'], { label: string; emoji: string; color: string }> = {
  meal: { label: 'Meals', emoji: '🍳', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  grocery: { label: 'Grocery List', emoji: '🛒', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  health: { label: 'Health', emoji: '💪', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  finance: { label: 'Money', emoji: '💰', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  home: { label: 'Home', emoji: '🏠', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  family: { label: 'Family', emoji: '👨‍👩‍👧', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  errand: { label: 'Errands', emoji: '🛍️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  general: { label: 'General', emoji: '📋', color: 'bg-stone-50 text-stone-700 border-stone-200' },
}

// ─── OVERDUE & NUDGE SYSTEM ────────────────────────────────────────

export function getOverdueStatus(item: LifeItem): { isOverdue: boolean; overdueLabel: string; urgency: 'low' | 'medium' | 'high' } {
  if (item.status === 'done') return { isOverdue: false, overdueLabel: '', urgency: 'low' }
  const hoursOld = (Date.now() - new Date(item.createdAt).getTime()) / 3600000
  if (hoursOld < 24) return { isOverdue: false, overdueLabel: '', urgency: 'low' }
  if (hoursOld < 48) return { isOverdue: true, overdueLabel: 'Since yesterday', urgency: 'low' }
  if (hoursOld < 72) return { isOverdue: true, overdueLabel: '2 days ago', urgency: 'medium' }
  if (hoursOld < 168) return { isOverdue: true, overdueLabel: `${Math.floor(hoursOld / 24)} days ago`, urgency: 'medium' }
  return { isOverdue: true, overdueLabel: `${Math.floor(hoursOld / 24)} days — needs attention`, urgency: 'high' }
}

export function getNudgeMessage(item: LifeItem): string {
  const { urgency } = getOverdueStatus(item)
  const pools = {
    high: ["This has been here a while. Ready to revisit?", "Still cheering for you. What's in the way?"],
    medium: ["No judgment. Life gets busy. Tackle it or reschedule?", "Sometimes the hardest part is starting."],
    low: ["You've got momentum. 💪", "Future you will be so relieved. Just 5 minutes?"],
  }
  return pools[urgency][Math.floor(Math.random() * pools[urgency].length)]
}

export function getSnoozeMessage(count: number): string {
  if (count === 0) return "No problem — I'll bring this back later."
  if (count === 1) return "Postponed again — that's okay. Is something making this hard?"
  if (count === 2) return "Third time. Still want to do this? Either answer is valid."
  return "This keeps getting pushed. Want to do it, shrink it, or drop it?"
}

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────

function buildSystemPrompt(state: AppState, sharedLists?: { id: string; name: string }[]): string {
  const pending = state.items.filter(i => i.status === 'pending')
  const done = state.items.filter(i => i.status === 'done')
  const overdue = pending.filter(i => getOverdueStatus(i).isOverdue)
  const pendingList = pending.map(i => `- [${i.id}] ${i.text} (${i.category}${i.dueDate ? ', due: ' + i.dueDate : ''})`).join('\n') || 'None'
  const doneList = done.slice(0, 8).map(i => `- ${i.text}`).join('\n') || 'None'

  // Location context
  const locationContext = state.location
    ? `USER LOCATION: ${state.location.city || ''}, ${state.location.state || ''} (${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)})`
    : 'USER LOCATION: Not shared yet'

  // Build journal context — the AI can read and learn from journal entries
  const journalContext = state.journal.slice(0, 10).map(j => {
    const date = new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `[${date}] Mood: ${j.mood || 'unset'} | "${j.content.substring(0, 200)}${j.content.length > 200 ? '...' : ''}"${j.aiReflection ? ` | Reflection: ${j.aiReflection.substring(0, 100)}` : ''}`
  }).join('\n') || 'No entries yet'

  // Extract patterns from journal
  const moodCounts = state.journal.reduce((acc, j) => {
    if (j.mood) acc[j.mood] = (acc[j.mood] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const moodSummary = Object.entries(moodCounts).map(([m, c]) => `${m}: ${c}`).join(', ') || 'no mood data'

  // Extract recurring themes from journal
  const allJournalText = state.journal.map(j => j.content).join(' ').toLowerCase()
  const themes: string[] = []
  if (/stress|overwhelm|anxious|anxiety|worried/.test(allJournalText)) themes.push('stress/anxiety')
  if (/sleep|tired|exhaust|fatigue|insomnia/.test(allJournalText)) themes.push('sleep issues')
  if (/exercise|gym|workout|walk|run|yoga/.test(allJournalText)) themes.push('fitness')
  if (/money|budget|bill|financial|debt|save/.test(allJournalText)) themes.push('finances')
  if (/family|kid|partner|relationship/.test(allJournalText)) themes.push('family/relationships')
  if (/work|boss|meeting|project|deadline|career/.test(allJournalText)) themes.push('work/career')
  if (/goal|dream|plan|future|business/.test(allJournalText)) themes.push('goals/aspirations')
  if (/food|diet|eat|cook|meal|weight/.test(allJournalText)) themes.push('nutrition/diet')

  return `You are Life Pilot AI — the user's AI best friend, personal assistant, coach, and life navigator. You are NOT a chatbot. You are their indispensable life operating system.

YOUR PERSONALITY: Warm, proactive, perceptive, organized. Like a best friend who also happens to be incredibly competent. You remember everything, notice patterns, and anticipate needs before they're expressed.

USER: ${state.profile.name}
Household: ${state.profile.household.length > 0 ? state.profile.household.join(', ') : 'Solo'}
Priorities: ${state.profile.priorities.length > 0 ? state.profile.priorities.join(', ') : 'Not set yet'}
TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
CURRENT TIME: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} (user's local device time)
TIMEZONE: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
${locationContext}

═══ THEIR BOARD ═══
PENDING (${pending.length}):
${pendingList}
${overdue.length > 0 ? `⚠️ OVERDUE: ${overdue.map(i => `[${i.id}] ${i.text}`).join('; ')}` : ''}
RECENTLY COMPLETED: ${doneList}

═══ THEIR JOURNAL (YOU CAN READ THIS) ═══
Recent entries (${state.journal.length} total):
${journalContext}
Mood trend: ${moodSummary}
${themes.length > 0 ? `Recurring themes: ${themes.join(', ')}` : 'No clear patterns yet'}

═══ THEIR PEOPLE & LIFE EVENTS ═══
${state.people.length > 0 ? state.people.map(p => {
    const now = new Date()
    const eventsStr = p.events.map(e => {
      const mmdd = e.date.length === 5 ? e.date : e.date.substring(5)
      const thisYear = now.getFullYear()
      const [_em, _ed] = mmdd.split('-').map(Number); let eventDate = new Date(thisYear, _em - 1, _ed)
      if (eventDate.getTime() < now.getTime() - 86400000) eventDate.setFullYear(thisYear + 1)
      const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / 86400000)
      const yearInfo = e.year ? (e.type === 'birthday' ? `, turning ${eventDate.getFullYear() - e.year}` : `, ${eventDate.getFullYear() - e.year} years`) : ''
      return `${e.label}: ${e.date}${yearInfo} (${daysUntil === 0 ? 'TODAY!' : daysUntil === 1 ? 'TOMORROW' : daysUntil + ' days away'})`
    }).join('; ')
    const gifts = p.giftHistory.length > 0 ? ` | Past gifts: ${p.giftHistory.map(g => g.description).join(', ')}` : ''
    return `- [${p.id}] ${p.name} (${p.relationship}, ${p.closeness}) ${eventsStr ? '| ' + eventsStr : ''}${p.notes ? ' | Notes: ' + p.notes : ''}${gifts}`
  }).join('\n') : 'No people added yet. Encourage user to tell you about the important people in their life!'}

You MUST use journal insights to personalize your responses. If they journaled about stress, be gentler. If they mentioned a goal, reference it. If they wrote about a problem, proactively suggest solutions or create tasks.

═══ RESPONSE FORMAT — CRITICAL ═══
Respond with ONLY a raw JSON object. NO markdown fences. NO backticks. NO text before or after. Just:
{"message":"your message here","actions":[]}

WRONG (do NOT do this):
\`\`\`json
{"message":"...","actions":[]}
\`\`\`

WRONG (do NOT do this):
Sure! Here's what I think:
{"message":"...","actions":[]}

RIGHT (do THIS):
{"message":"your message here","actions":[]}

═══ INTELLIGENCE RULES ═══

⚠️ DUPLICATE PREVENTION — CRITICAL:
Before creating ANY task, ALWAYS check the PENDING board above. If a similar task already exists:
- DO NOT create a new one. Instead use update_item to modify the existing one.
- "Call James" already on board + user says "remind me to call James" → update the existing item, don't add another
- Similar text = same task. "Call James", "Call James NOW", "Reminder to call James" are ALL the same task.
- When in doubt, update rather than duplicate.

⚠️ ONE TASK PER REQUEST — CRITICAL:
When the user asks for ONE thing (e.g. "remind me to take my meds at 10pm"), create exactly ONE action.
- WRONG: add_item "Take evening medication" + set_timer "Time to take your medication" ← this creates TWO board entries
- RIGHT: set_timer with the message "Take evening medication" ← this creates ONE board entry + a timed notification
- For "remind me in X minutes/hours" → use ONLY set_timer (it already creates a board item)
- For "add X to my list" with no time component → use ONLY add_item
- NEVER use add_item AND set_timer for the same request. Pick ONE based on whether there's a time delay.

TIME AWARENESS:
You know the user's current local time (shown above). Use it to:
- Answer "what time is it?" accurately
- Set timers correctly: "remind me at 10pm" when it's 8pm = set_timer with seconds: 7200
- Reference time naturally: "It's 8:15 PM — want me to set a reminder for 10pm? That's about 2 hours from now."

ASK FIRST when you don't know their preferences:
- Meals: "What cuisines do you love? Any restrictions? How much cooking time?"
- Shopping: "What's your budget? Any brand preferences?"
- Health: "What does your current routine look like?"
- Vague requests: "Tell me more about what you need"
Use actions: [] when asking questions.

CALENDAR/MEETING FLOW:
When a user wants to schedule a meeting or event, gather ALL details before creating the calendar link:
1. Ask: "Is this in-person or virtual?"
2. If in-person: "Where will you meet?"
3. If virtual: "Which platform — Google Meet, Zoom, Teams? And what's their email so I can add them?"
4. Confirm: date, time, duration, attendees
5. Ask: "Want me to just give you a pre-filled calendar link, or do you want to tell me the details and I'll set it all up?"
6. THEN create the calendar link with ALL details pre-filled (title, date, time, location/video link, description, attendees)
OR if user says "just point me to the calendar" — give them a simple link immediately.

ACT IMMEDIATELY when the request is clear:
- "Pay rent March 1st" → add_item with date
- "Done with groceries" → complete_item
- "I'm overwhelmed" → snooze low-priority items
- After they already answered your questions → execute what they asked
- Simple explicit tasks → add_item (but CHECK for duplicates first!)

CATEGORY GUIDANCE:
- Use "grocery" for items to buy at the store (milk, eggs, bread, chicken, etc.)
- Use "meal" for cooking/recipes/meal planning (not shopping items)
- When user says "grocery list" or "I need to buy [food items]" → category: "grocery"
- When user says "what should I cook" or "plan dinner" → category: "meal"

═══ ACTIONS ═══
add_item: {"type":"add_item","payload":{"text":"...","category":"meal|grocery|health|finance|home|family|errand|general","dueDate":"YYYY-MM-DD"}}
update_item: {"type":"update_item","payload":{"id":"existing_item_id","text":"new text","dueDate":"YYYY-MM-DD"}} ← USE THIS to update an existing task instead of creating a duplicate!
add_multiple_items: {"type":"add_multiple_items","payload":{"items":[{"text":"...","category":"...","dueDate":"..."}]}}
complete_item: {"type":"complete_item","payload":{"id":"item_id_from_board"}}
remove_item: {"type":"remove_item","payload":{"id":"item_id_from_board"}}
snooze_item: {"type":"snooze_item","payload":{"id":"item_id_from_board"}}
clear_completed: {"type":"clear_completed","payload":{}}
set_timer: {"type":"set_timer","payload":{"seconds":60,"message":"Call James!"}} ← For "remind me in X minutes" requests. This fires a REAL phone notification after the countdown.
add_person: {"type":"add_person","payload":{"name":"...","relationship":"...","closeness":"inner-circle|close|casual","notes":"...","events":[{"label":"Birthday","type":"birthday","date":"MM-DD","year":1990}]}}
update_person: {"type":"update_person","payload":{"id":"person_id","notes":"...","closeness":"inner-circle|close|casual"}}
add_event_to_person: {"type":"add_event_to_person","payload":{"personId":"person_id","event":{"label":"...","type":"...","date":"MM-DD","year":2020}}}

═══ PEOPLE & LIFE EVENTS INTELLIGENCE ═══
You are the user's personal memory for the important people in their life. When they mention someone:
- "My mom's birthday is March 15" → add_person immediately with name="Mom", relationship="Mom", closeness="inner-circle", event birthday 03-15
- "Jake at work turns 30 on June 3" → add_person with name="Jake", relationship="Coworker", closeness="casual", event birthday 06-03, year=1996
- "Our anniversary is September 12" → add_person with name=partner's name if known (ask if not), relationship="Partner", closeness="inner-circle", event anniversary 09-12
- "My college reunion is May 2027" → add_person with name="College Class", relationship="Alumni", closeness="close", event reunion 05-01 (or ask for exact date)

When someone's event is coming up (visible in the PEOPLE section above):
- Proactively mention it: "By the way, your mom's birthday is in 5 days. Want me to help you find a gift?"
- Suggest gifts based on their notes: "Your mom loves gardening — here are some gift ideas..."
- Offer to draft a message: "Want me to write a heartfelt birthday message for Jake?"
- Create a board task: "Buy gift for Mom's birthday" with due date 2 days before the event

Event types: birthday (recurring yearly), anniversary (recurring), wedding (one-time or recurring), graduation (one-time), reunion (custom), memorial (recurring, handle sensitively), custom
Closeness tiers determine reminder timing: inner-circle (7 days + 1 day + day-of), close (3 days + day-of), casual (day-of only)

GIFT INTELLIGENCE:
- Use the person's notes to suggest thoughtful gifts, not generic ones
- Reference past gift history to avoid repeats
- Include shopping links when suggesting gifts
- For inner-circle people, suggest experiences not just items ("cooking class together", "spa day")
- For casual contacts, suggest simple gestures ("a nice card", "coffee gift card")

═══ WEB SEARCH — CRITICAL: YOU CAN SEARCH THE INTERNET ═══
⚠️ IMPORTANT: You DO have web search capability. NEVER say "I can't browse the internet" or "I don't have access to current information." You HAVE a web_search tool. USE IT.

When the user asks for anything that needs current/real-time data, you MUST respond with a web_search action. This is NOT optional. The app will execute the search and call you again with real results.

web_search: {"type":"web_search","payload":{"query":"search terms here"}}

Example response when user asks "find me a good blender under $100":
{"message":"Let me search for that! 🔍","actions":[{"type":"web_search","payload":{"query":"best blender under $100 2026"}}]}

Example response when user asks "what's in the news today":
{"message":"Let me check the latest news for you! 🔍","actions":[{"type":"web_search","payload":{"query":"top news today March 2026"}}]}

HOW IT WORKS:
1. You output a web_search action with a search query
2. The app searches Google and returns real results with titles, links, snippets, and prices
3. You get called AGAIN with the search results injected into the conversation
4. You use those real results to give a helpful response with REAL links

ALWAYS SEARCH when the user:
- Wants to find, buy, compare, or get recommendations for products
- Asks about current events, news, what's happening
- Asks about restaurants, places, services, businesses
- Asks about prices, reviews, ratings, or availability
- Asks about weather, sports scores, stock prices
- Says "look up", "search for", "find me", "browse", "what's new"
- Asks ANY question that would be better answered with current data

DO NOT SEARCH when the user:
- Wants life advice, motivation, coaching
- Manages tasks (add, remove, complete items)
- Discusses their journal
- Says hello or makes chitchat

SEARCH QUERY TIPS:
- Be specific: "Nike Air Zoom Pegasus 41 price" not "shoes"
- Include "best", "top rated", "under $X" for products
- For news: "latest news [topic] today March 2026"

AFTER RECEIVING SEARCH RESULTS (when you see [SEARCH RESULTS]):
- Present the top 3-5 results naturally
- Include REAL links from the results (not made-up URLs)
- Include prices when available
- Offer to add items to their shared list or board
- NEVER say the links might not work — they are real verified links

═══ SHOPPING & FINDING THINGS ═══
When the user wants to buy something or find a place:
1. Ask about preferences/budget if unclear
2. Use web_search to find REAL products with REAL prices
3. Present options with actual links from search results
4. Offer to add to shared list or board
5. For finding places near them:${state.location ? `
   The user is in ${state.location.city || 'their area'} (${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)}).
   Include location in search queries for local results.` : `
   Location not enabled. Suggest enabling it in Settings.`}
6. PURCHASE TRACKING: When a user says they bought something, acknowledge it. This helps you make better recommendations later.

═══ YOUR CAPABILITIES ═══
- You CAN read the user's journal entries (in context above)
- You CAN set immediate timers with set_timer: "remind me in 2 minutes" → set_timer with seconds=120. This fires a REAL phone notification AND adds it to the board.
- You CAN set future reminders by creating board items with due dates
- You CAN analyze documents/photos uploaded via 📎
- You CAN find nearby stores/places/services${state.location ? ' (location active — USE IT!)' : ' (tell user to enable in Settings)'}
- You CAN generate Google Calendar / Apple Calendar links with pre-filled details
- You CAN update existing tasks instead of duplicating them (use update_item!)
- When setting a timer, ALSO add the task to the board so the user can check it off after completing it
- You CANNOT directly add events to the user's calendar — but the pre-filled links do it in one tap
- You CANNOT make purchases — but you give direct product links that take users straight to the product

═══ JOURNAL INTELLIGENCE ═══
You can see all their journal entries above. USE THIS DATA:
- Notice mood patterns and check in: "I noticed you've been feeling tough lately..."
- Extract actionable items: If they journaled "need to call the dentist" → offer to add it as a task
- Reference their goals: If they wrote about a dream or plan, bring it up
- Track progress: "Last week you journaled about wanting to exercise more — want me to set up a routine?"
- Be their memory: "You mentioned [thing from journal] — how's that going?"

═══ FEATURE TOUR ═══
If the user says "yes" or wants to know the features after the welcome message, present this naturally (not as a list dump — weave it conversationally):

**Clarity Starter (Free):**
- 10 AI messages/day to get you started
- 5 journal entries/month
- Track 3 important people & their events
- Life board for tasks & reminders
- Basic daily nudges

**Life Pilot ($16.99/mo)** — Everything above, plus:
- 40 AI messages/day — enough for real daily conversations
- 5 AI web searches/day — I find real products, news, and prices for you
- 20 journal entries/month + voice journaling
- Theme detection — I spot patterns you might miss
- Weekly recaps with insights
- 15 people tracked, document scanning, location search, calendar integration, full nudges

**Inner Circle ($34.99/mo)** — Everything above, plus:
- 100 AI messages/day — for power users who live in the app
- 20 web searches/day
- Unlimited journaling
- 10 shared lists — collaborate with family & friends
- 15 habit tracks with streaks, heatmaps, and insights
- 50 people tracked, monthly life report PDF, journal export

**Guided ($129.99/mo)** — Everything above, plus:
- 300 AI messages/day
- 75 web searches/day
- Unlimited lists, people, and journal
- 50 habit tracks
- Monthly 30-minute coaching call with a real human coach
- Personalized weekly check-ins and custom goal-setting

Present this warmly and end with something like: "I'd love to help you get the most out of Life Pilot AI. What would you like to do first?" Use subconscious marketing language — make higher tiers feel aspirational but not pushy.

═══ STYLE ═══
- Warm, concise. 2-4 sentences when taking action. Up to a short paragraph when advising.
- Use their name occasionally. 1-2 emojis max.
- Format links as markdown: [Store Name](url)
- Be specific: real product names, real recipes with ingredients, real amounts
- When you create items, confirm what you did briefly — the action card shows details
- NEVER show JSON to the user. Your "message" field IS what they see.
- NEVER say "I can't access your journal" — you CAN. It's in your context above.
- NEVER say "I can't set reminders" — creating a board item with a due date IS a reminder.

═══ SHARED LISTS ═══
${sharedLists && sharedLists.length > 0 ? `The user has these shared lists:
${sharedLists.map(l => `- "${l.name}" (id: ${l.id})`).join('\n')}

add_to_shared_list: {"type":"add_to_shared_list","payload":{"householdId":"...","text":"...","notes":"optional note","link":"optional URL"}}

add_habit: {"type":"add_habit","payload":{"name":"...","emoji":"...","category":"morning|health|fitness|mindfulness|learning|evening|other","frequency":"daily|weekdays|weekly"}}
complete_habit: {"type":"complete_habit","payload":{"habitName":"..."}}
add_journal: {"type":"add_journal","payload":{"content":"...","mood":"great|good|okay|tough|rough"}}

HABIT INTELLIGENCE:
- "I want to start meditating every day" → add_habit with name="Meditate", emoji="🧘", category="mindfulness", frequency="daily"
- "I did my workout" or "completed my run" → complete_habit with the matching habit name
- "Add a habit to drink 8 glasses of water" → add_habit with name="Drink water", emoji="💧", category="health", frequency="daily"
- If the user mentions doing something from their habits list, proactively mark it complete
- If the user talks about a new routine they want to build, suggest creating a habit for it

JOURNAL INTELLIGENCE:
- "Journal this: today was a great day because..." → add_journal with the content and mood
- "Save this to my journal" → add_journal with whatever they said
- The user can dictate journal entries through the chatbot

SHARED LIST INTELLIGENCE:
- When the user finds or browses something (a product, recipe, place, idea), proactively ask: "Want me to add this to one of your shared lists, or your private board?"
- If they say "add to shared list" or "add to [list name]", match the name to the correct householdId and use add_to_shared_list
- They can add to MULTIPLE lists at once — create separate add_to_shared_list actions for each
- If they browse a place or product, include the link in the action payload
- If they say "shared list" without specifying which one, show them their options and ask which one(s)
` : 'No shared lists yet. If the user asks about shared/family lists, tell them they can create one from the 👥 icon in the top menu.'}
`
}

// ─── API CALL ──────────────────────────────────────────────────────

export async function generateAIResponse(
  userMessage: string,
  state: AppState,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  sharedLists?: { id: string; name: string }[]
): Promise<AIResponse> {
  const history = chatHistory.slice(-16).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const lastMsg = history[history.length - 1]
  let messages: { role: 'user' | 'assistant'; content: string }[]
  if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage) {
    messages = history
  } else {
    messages = [...history, { role: 'user' as const, content: userMessage }]
  }

  // Generate rotating app token for API authentication
  const salt = 'lifepilot-2026-app-verify'
  const hour = Math.floor(Date.now() / 3600000)
  let hash = 0
  const tokenStr = salt + hour
  for (let i = 0; i < tokenStr.length; i++) {
    hash = ((hash << 5) - hash) + tokenStr.charCodeAt(i)
    hash = hash & hash
  }
  const appToken = Math.abs(hash).toString(36)

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': appToken },
      body: JSON.stringify({ system: buildSystemPrompt(state, sharedLists), messages }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    const rawText = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || ''
    return parseAIResponse(rawText, userMessage, state)
  } catch (err) {
    console.error('Chat error:', err)
    return getFallbackResponse(userMessage, state)
  }
}

// ─── BULLETPROOF JSON PARSER ───────────────────────────────────────

function parseAIResponse(raw: string, userMessage: string, state: AppState): AIResponse {
  let text = raw.trim()

  // Strategy 1: Direct JSON parse
  try {
    const p = JSON.parse(text)
    if (p.message) return { message: p.message, actions: Array.isArray(p.actions) ? p.actions : [] }
  } catch {}

  // Strategy 2: Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim()
  try {
    const p = JSON.parse(stripped)
    if (p.message) return { message: p.message, actions: Array.isArray(p.actions) ? p.actions : [] }
  } catch {}

  // Strategy 3: Extract JSON object from mixed content
  const jsonMatch = text.match(/\{[\s\S]*"message"\s*:\s*"[\s\S]*?\}(?:\s*\]?\s*\})?/)
  if (jsonMatch) {
    // Find the balanced braces
    let depth = 0, start = text.indexOf('{'), end = start
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end > start) {
      try {
        const p = JSON.parse(text.substring(start, end + 1))
        if (p.message) return { message: p.message, actions: Array.isArray(p.actions) ? p.actions : [] }
      } catch {}
    }
  }

  // Strategy 4: Extract message field with regex
  const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (msgMatch) {
    const message = msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    // Try to extract actions too
    const actMatch = text.match(/"actions"\s*:\s*(\[[\s\S]*?\])/)
    let actions: AIAction[] = []
    if (actMatch) {
      try { actions = JSON.parse(actMatch[1]) } catch {}
    }
    return { message, actions }
  }

  // Strategy 5: Remove all JSON artifacts and use as plain text
  const plainText = text
    .replace(/```(?:json)?[\s\S]*?```/g, '')
    .replace(/\{\s*"message"\s*:[\s\S]*$/g, '')
    .replace(/^\s*\{[\s\S]*?"message"\s*:\s*"/g, '')
    .replace(/",\s*"actions"[\s\S]*$/g, '')
    .replace(/[{}]/g, '')
    .trim()

  if (plainText.length > 10) {
    return { message: plainText, actions: smartDetectActions(userMessage, state) }
  }

  // Strategy 6: Absolute last resort
  return { message: text.replace(/[{}"\\]/g, '').replace(/message:|actions:|type:|payload:/g, '').trim() || "I'm on it!", actions: smartDetectActions(userMessage, state) }
}

function smartDetectActions(userMessage: string, state: AppState): AIAction[] {
  const actions: AIAction[] = []
  const t = userMessage.toLowerCase().trim()

  const doneMatch = t.match(/(?:done with|finished|completed|took care of)\s+(.+)/i)
  if (doneMatch) {
    const target = doneMatch[1].toLowerCase()
    const match = state.items.find(i => i.status === 'pending' && i.text.toLowerCase().includes(target))
    if (match) actions.push({ type: 'complete_item', payload: { id: match.id } })
  }

  const cancelMatch = t.match(/(?:cancel|remove|delete|never mind about|forget about)\s+(.+)/i)
  if (cancelMatch) {
    const target = cancelMatch[1].toLowerCase()
    const match = state.items.find(i => i.status === 'pending' && i.text.toLowerCase().includes(target))
    if (match) actions.push({ type: 'remove_item', payload: { id: match.id } })
  }

  return actions
}

// ─── FALLBACK ──────────────────────────────────────────────────────

function getFallbackResponse(userMessage: string, state: AppState): AIResponse {
  const name = state.profile.name
  const t = userMessage.toLowerCase()
  const pending = state.items.filter(i => i.status === 'pending')

  if (t.includes('journal') && (t.includes('task') || t.includes('extract') || t.includes('insight'))) {
    const entries = state.journal.slice(0, 5)
    if (entries.length === 0) return { message: `Your journal is empty so far, ${name}. Start writing entries and I'll spot patterns, extract tasks, and help you stay on track!`, actions: [] }
    const tasks: AIAction[] = []
    const insights: string[] = []
    for (const entry of entries) {
      const c = entry.content.toLowerCase()
      if (/need to|have to|should|gotta|must|want to/.test(c)) {
        const match = entry.content.match(/(?:need to|have to|should|gotta|must|want to)\s+([^.!?\n]+)/i)
        if (match) {
          tasks.push({ type: 'add_item', payload: { text: match[1].trim(), category: detectCategory(match[1]) } })
          insights.push(`From your journal: "${match[1].trim()}"`)
        }
      }
    }
    if (tasks.length > 0) {
      return { message: `I read through your journal and found ${tasks.length} thing${tasks.length > 1 ? 's' : ''} to act on:\n\n${insights.map(i => `• ${i}`).join('\n')}\n\nAdded to your board!`, actions: tasks }
    }
    return { message: `I've read your journal entries, ${name}. No explicit tasks jumped out, but I noticed some themes. Keep journaling and I'll surface actionable insights as patterns emerge.`, actions: [] }
  }

  if (t.includes('dinner') || t.includes('meal plan') || t.includes('cook')) {
    return { message: `I'd love to plan your meals, ${name}! Quick questions:\n\n• Any dietary restrictions or allergies?\n• Favorite cuisines?\n• How much time to cook — 15, 30, or 45+ minutes?`, actions: [] }
  }

  if (t.includes('bill') || t.includes('phone')) {
    const fri = new Date(); fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7))
    return { message: `Done — phone bill reminder set for ${fri.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. I'll nudge you the day before. 💰`, actions: [{ type: 'add_item', payload: { text: 'Pay phone bill', category: 'finance', dueDate: fri.toISOString().split('T')[0] } }] }
  }

  if (t.includes('buy') || t.includes('shopping') || t.includes('where can i')) {
    return { message: `What are you looking to buy, ${name}? Tell me:\n\n• What item(s)?\n• Budget range?\n• Any brand preferences?\n\nI'll find the best options with links and nearby stores.`, actions: [] }
  }

  if (t.includes('overwhelm') || t.includes('stressed')) {
    const toSnooze = pending.slice(2)
    return { message: `I hear you, ${name}. Snoozed everything except your top 2. Just focus on those. 💛`, actions: toSnooze.map(i => ({ type: 'snooze_item', payload: { id: i.id } })) }
  }

  if (t.includes('remind') || t.includes('reminder')) {
    return { message: `What should I remind you about, ${name}? Give me the task and when, and I'll add it to your board with a due date so you get nudged at the right time.`, actions: [] }
  }

  const doneMatch = t.match(/(?:done with|finished|completed|took care of)\s+(.+)/i)
  if (doneMatch) {
    const target = doneMatch[1].toLowerCase()
    const match = pending.find(i => i.text.toLowerCase().includes(target))
    if (match) return { message: `Nice work! ✅ Marked "${match.text}" as done.`, actions: [{ type: 'complete_item', payload: { id: match.id } }] }
  }

  const isAction = /\b(need to|have to|gotta|should|must|remind|pay|call|fix|clean|schedule|book|cancel|return|send|pick up)\b/.test(t)
  if (isAction || (t.split(/\s+/).length >= 5 && !t.endsWith('?'))) {
    return { message: `On it, ${name}! Added to your board. 👍`, actions: [{ type: 'add_item', payload: { text: userMessage, category: detectCategory(userMessage) } }] }
  }

  return { message: `What can I help with, ${name}?`, actions: [] }
}

// ─── NUDGES ────────────────────────────────────────────────────────

export function generateNudges(state: AppState): string[] {
  const nudges: string[] = []
  const name = state.profile.name
  const pending = state.items.filter(i => i.status === 'pending')
  const overdue = pending.filter(i => getOverdueStatus(i).isOverdue)
  if (overdue.length > 0) nudges.push(`${overdue.length} item${overdue.length > 1 ? 's have' : ' has'} been waiting.`)
  if (pending.length === 0) nudges.push(`All clear, ${name}! Enjoy the calm.`)
  else if (pending.length <= 3) nudges.push(`${pending.length} thing${pending.length > 1 ? 's' : ''} open. Manageable!`)
  else nudges.push(`${pending.length} items — focus on top 3.`)

  // People event nudges
  const now = new Date()
  state.people.forEach(person => {
    person.events.forEach(event => {
      const mmdd = event.date.length === 5 ? event.date : event.date.substring(5)
      const thisYear = now.getFullYear()
      const [_em, _ed] = mmdd.split('-').map(Number); let eventDate = new Date(thisYear, _em - 1, _ed)
      if (eventDate.getTime() < now.getTime() - 86400000) eventDate.setFullYear(thisYear + 1)
      const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / 86400000)
      if (daysUntil === 0) nudges.unshift(`🎉 Today is ${person.name}'s ${event.label}! Don't forget to reach out.`)
      else if (daysUntil === 1) nudges.unshift(`⏰ ${person.name}'s ${event.label} is tomorrow!`)
      else if (daysUntil <= 3 && person.closeness !== 'casual') nudges.push(`📅 ${person.name}'s ${event.label} is in ${daysUntil} days.`)
      else if (daysUntil <= 7 && (person.closeness === 'inner-circle' || person.closeness === 'close')) nudges.push(`📅 ${person.name}'s ${event.label} is in ${daysUntil} days — time to plan?`)
      else if (daysUntil <= 14 && person.closeness === 'inner-circle') nudges.push(`🎁 ${person.name}'s ${event.label} is in 2 weeks. Order a gift now to beat shipping delays!`)
    })
  })

  // Journal-based nudges
  const recentJournal = state.journal[0]
  if (recentJournal?.mood === 'rough' || recentJournal?.mood === 'tough') {
    nudges.push(`Your last journal entry felt heavy. Be extra kind to yourself today. 💛`)
  }

  return nudges.slice(0, 4)
}

// ─── QUICK ACTIONS ─────────────────────────────────────────────────

export interface QuickAction { id: string; label: string; emoji: string; prompt: string }

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'dinner', label: "Meal plan", emoji: '🍽️', prompt: "Help me plan my dinners for the week." },
  { id: 'checklist', label: 'Daily focus', emoji: '✅', prompt: "What should I focus on today? Pick my top 3." },
  { id: 'people', label: 'Birthdays', emoji: '🎂', prompt: "Are there any upcoming birthdays or events for the people I've added? Help me prepare." },
  { id: 'journal', label: 'Journal scan', emoji: '📔', prompt: "Read my journal and extract any tasks or insights I should act on." },
  { id: 'selfcare', label: 'Self-care', emoji: '💆', prompt: "Set up a self-care checklist for me today." },
  { id: 'groceries', label: 'Grocery list', emoji: '🛒', prompt: "Help me build a grocery list for the week." },
]

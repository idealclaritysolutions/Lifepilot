import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Simple admin auth via secret key
  const adminKey = req.headers['x-admin-key'] || req.query.key
  if (adminKey !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Fetch all user data
    const { data: allUsers, error } = await supabase
      .from('user_data')
      .select('user_id, app_state, updated_at')
    
    if (error) throw error

    // Filter to Guided (enterprise) tier users only
    const guidedUsers = (allUsers || [])
      .filter(u => u.app_state?.subscription?.tier === 'enterprise')
      .map(u => {
        const s = u.app_state
        const goals = (s.goals || []).filter(g => g.status === 'active')
        const items = s.items || []
        const habits = s.habits || []
        const todayStr = new Date().toISOString().split('T')[0]

        return {
          userId: u.user_id,
          name: s.profile?.name || 'Unknown',
          lastActive: u.updated_at,
          subscription: s.subscription,
          stats: {
            activeGoals: goals.length,
            pendingTasks: items.filter(i => i.status === 'pending').length,
            completedTasks: items.filter(i => i.status === 'done').length,
            totalHabits: habits.length,
            habitsCompletedToday: habits.filter(h => h.completions?.includes(todayStr)).length,
            journalEntries: (s.journal || []).length,
            focusMinutesTotal: (s.focusSessions || []).reduce((a, b) => a + (b.minutes || 0), 0),
          },
          goals: goals.map(g => {
            const goalTasks = items.filter(i => i.goalId === g.id)
            const goalHabits = habits.filter(h => (g.linkedHabitIds || []).includes(h.id))
            const tasksDone = goalTasks.filter(t => t.status === 'done').length
            const totalSteps = goalTasks.length + (g.milestones || []).length
            const completedSteps = tasksDone + (g.milestones || []).filter(m => m.completed).length
            return {
              id: g.id,
              title: g.title,
              category: g.category,
              targetDate: g.targetDate,
              createdAt: g.createdAt,
              progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
              totalSteps,
              completedSteps,
              tasks: goalTasks.map(t => ({ text: t.text, status: t.status, dueDate: t.dueDate })),
              habits: goalHabits.map(h => ({
                name: h.name,
                emoji: h.emoji,
                streak: (() => { let s = 0; const comps = h.completions || []; for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (comps.includes(d.toISOString().split('T')[0])) s++; else if (i > 0) break } return s })(),
              })),
            }
          }),
        }
      })

    return res.status(200).json({ users: guidedUsers, count: guidedUsers.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

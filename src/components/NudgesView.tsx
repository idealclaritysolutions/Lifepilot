import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AppState } from '@/App'
import { generateNudges, QUICK_ACTIONS } from '@/lib/ai-engine'
import { Bell, Sun, Moon, Coffee, Sunset, FlaskConical } from 'lucide-react'
import { testNudgeNotification, getNotificationStatus } from '@/lib/notifications'

interface Props {
  state: AppState
  addChat: (msg: { role: 'user' | 'assistant'; content: string }) => void
  onNavigateToChat: () => void
}

export function NudgesView({ state, addChat, onNavigateToChat }: Props) {
  const [nudges] = useState(() => generateNudges(state))
  const [notificationStatus, setNotificationStatus] = useState(() => getNotificationStatus())
  const hour = new Date().getHours()

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const GreetingIcon = hour < 12 ? Coffee : hour < 17 ? Sun : hour < 20 ? Sunset : Moon

  const pendingItems = state.items.filter(i => i.status === 'pending')
  const todayItems = pendingItems.filter(i => {
    const created = new Date(i.createdAt)
    const today = new Date()
    return created.toDateString() === today.toDateString()
  })

  // Fun stats
  const totalDone = state.items.filter(i => i.status === 'done').length
  const streak = totalDone > 0 ? Math.min(totalDone, 7) : 0

  const handleTestNotification = async (type: 'feature' | 'task' | 'journal' | 'habit') => {
    // Request permission if not yet granted
    if (notificationStatus !== 'granted') {
      try {
        const permission = await Notification.requestPermission()
        setNotificationStatus(permission)
        if (permission !== 'granted') return
      } catch (e) {
        console.error('Failed to request notification permission:', e)
        return
      }
    }
    testNudgeNotification(type)
  }

  return (
    <div className="px-4 py-4">
      {/* Greeting card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 mb-4 border border-amber-100/50">
        <div className="flex items-center gap-2 mb-2">
          <GreetingIcon className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>
            {greeting}, {state.profile.name}
          </h2>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed">
          {pendingItems.length === 0
            ? "Your plate is clear! Enjoy the peace — or tell me what's next."
            : pendingItems.length <= 3
            ? `You've got ${pendingItems.length} thing${pendingItems.length > 1 ? 's' : ''} on your plate. Very manageable.`
            : `You have ${pendingItems.length} items to tackle. Let's prioritize the top 3.`
          }
        </p>
        {totalDone > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 text-xs">
              <span className="text-amber-500">🔥</span>
              <span className="text-stone-600 font-medium">{totalDone} tasks completed</span>
            </div>
          </div>
        )}
      </div>

      {/* Smart nudges */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-1">
          Smart Nudges
        </h3>
        <div className="space-y-2">
          {nudges.map((nudge, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-none">
                  <Bell className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-sm text-stone-600 leading-relaxed flex-1">{nudge}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's pending items */}
      {pendingItems.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-1">
            Open Items
          </h3>
          <div className="bg-white rounded-xl border border-stone-100 divide-y divide-stone-50 shadow-sm overflow-hidden">
            {pendingItems.slice(0, 5).map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-sm">{
                  item.category === 'meal' ? '🍳' :
                  item.category === 'health' ? '💪' :
                  item.category === 'finance' ? '💰' :
                  item.category === 'home' ? '🏠' :
                  item.category === 'family' ? '👨‍👩‍👧' :
                  item.category === 'errand' ? '🛍️' : '📋'
                }</span>
                <p className="text-sm text-stone-600 flex-1 truncate">{item.text}</p>
              </div>
            ))}
            {pendingItems.length > 5 && (
              <div className="px-4 py-2 text-center">
                <p className="text-xs text-stone-400">+ {pendingItems.length - 5} more items</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              onClick={onNavigateToChat}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left shadow-sm"
            >
              <span className="text-base">{action.emoji}</span>
              <span className="text-sm text-stone-600 font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Test Nudge Notifications (Dev/Debug) */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
          <FlaskConical className="w-3 h-3" />
          Test Push Notifications
        </h3>
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 mb-3">
            {notificationStatus === 'granted'
              ? 'Tap a button to send a test notification immediately:'
              : notificationStatus === 'denied'
              ? 'Notifications are blocked. Enable them in your browser settings to test.'
              : 'Tap a button to enable notifications and send a test immediately:'}
          </p>
          {notificationStatus !== 'denied' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('feature')}
                className="text-xs"
              >
                Feature Discovery
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('task')}
                className="text-xs"
              >
                Task Reminder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('journal')}
                className="text-xs"
              >
                Journal Reminder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification('habit')}
                className="text-xs"
              >
                Habit Check-in
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Motivational footer */}
      <div className="mt-6 text-center py-4">
        <p className="text-xs text-stone-400 italic">
          "The secret to getting ahead is getting started." — Mark Twain
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain, Timer, TrendingUp, Volume2, VolumeX, MessageCircle, X, ChevronDown, ChevronUp } from 'lucide-react'

interface FocusSession {
  date: string
  minutes: number
  count: number
}

interface Props {
  focusSessions: FocusSession[]
  onSessionComplete: (minutes: number) => void
  onAICoach?: (message: string) => void
}

type TimerState = 'idle' | 'focus' | 'break' | 'longBreak' | 'coaching'

const PRESETS = [
  { label: '25 / 5', focus: 25, break: 5, longBreak: 15 },
  { label: '50 / 10', focus: 50, break: 10, longBreak: 20 },
  { label: '15 / 3', focus: 15, break: 3, longBreak: 10 },
]

const SOUNDS = [
  { id: 'none', label: 'Silent', emoji: '🔇' },
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊' },
  { id: 'forest', label: 'Forest', emoji: '🌿' },
  { id: 'brown', label: 'Brown Noise', emoji: '🟤' },
  { id: 'white', label: 'White Noise', emoji: '⚪' },
]

function createNoiseGenerator(type: string, audioCtx: AudioContext): { start: () => void; stop: () => void } {
  let sourceNode: AudioBufferSourceNode | null = null
  let gainNode: GainNode | null = null
  let filterNode: BiquadFilterNode | null = null
  let lfoOsc: OscillatorNode | null = null

  return {
    start: () => {
      gainNode = audioCtx.createGain()
      const bufferSize = audioCtx.sampleRate * 2
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)

      if (type === 'white') {
        // Pure white noise
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      } else if (type === 'rain') {
        // Rain: brown noise base with random amplitude spikes (droplet effect)
        let lastOut = 0
        for (let i = 0; i < bufferSize; i++) {
          const w = Math.random() * 2 - 1
          lastOut = (lastOut + (0.02 * w)) / 1.02
          // Random droplet spikes every ~50-200 samples
          const droplet = Math.random() < 0.003 ? (Math.random() * 0.8) : 0
          data[i] = (lastOut * 2.5) + droplet
        }
      } else {
        // Brown noise base for ocean, forest, brown
        let lastOut = 0
        for (let i = 0; i < bufferSize; i++) {
          const w = Math.random() * 2 - 1
          data[i] = (lastOut + (0.02 * w)) / 1.02
          lastOut = data[i]
          data[i] *= 3.5
        }
      }

      sourceNode = audioCtx.createBufferSource()
      sourceNode.buffer = buffer
      sourceNode.loop = true
      filterNode = audioCtx.createBiquadFilter()

      if (type === 'rain') {
        // Rain: bandpass filter centered at 3kHz to sound like rainfall on a surface
        filterNode.type = 'bandpass'
        filterNode.frequency.value = 3000
        filterNode.Q.value = 0.3
        gainNode.gain.value = 0.25
        // Add slow amplitude modulation for natural variation
        lfoOsc = audioCtx.createOscillator()
        const lfoGain = audioCtx.createGain()
        lfoOsc.frequency.value = 0.3 // Slow rain intensity variation
        lfoGain.gain.value = 0.08
        lfoOsc.connect(lfoGain)
        lfoGain.connect(gainNode.gain)
        lfoOsc.start()
      } else if (type === 'ocean') {
        filterNode.type = 'lowpass'
        filterNode.frequency.value = 400
        gainNode.gain.value = 0.4
        lfoOsc = audioCtx.createOscillator()
        const lfoGain = audioCtx.createGain()
        lfoOsc.frequency.value = 0.1
        lfoGain.gain.value = 0.15
        lfoOsc.connect(lfoGain)
        lfoGain.connect(gainNode.gain)
        lfoOsc.start()
      } else if (type === 'forest') {
        filterNode.type = 'bandpass'
        filterNode.frequency.value = 2000
        filterNode.Q.value = 0.5
        gainNode.gain.value = 0.08
      } else if (type === 'brown') {
        filterNode.type = 'lowpass'
        filterNode.frequency.value = 500
        gainNode.gain.value = 0.5
      } else {
        filterNode.type = 'allpass'
        filterNode.frequency.value = 1000
        gainNode.gain.value = 0.15
      }

      sourceNode.connect(filterNode)
      filterNode.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      sourceNode.start()
    },
    stop: () => {
      try { sourceNode?.stop() } catch {}
      try { lfoOsc?.stop() } catch {}
      try { gainNode?.disconnect() } catch {}
      try { filterNode?.disconnect() } catch {}
    },
  }
}

function getCoachingPrompt(sessionCount: number, totalMinutes: number, timerMinutes: number): string {
  if (sessionCount === 1) {
    return `Great first session! You focused for ${timerMinutes} minutes. How did that feel — was the task manageable, or do you want to break it down further?`
  }
  if (sessionCount % 4 === 0) {
    return `💪 ${sessionCount} sessions done — that's ${totalMinutes} minutes of deep work today! You've earned this long break. What's the ONE thing you want to accomplish next?`
  }
  if (totalMinutes >= 120) {
    return `You've hit ${totalMinutes} minutes of focus today! 🔥 Are you still energized, or is it time to wrap up and protect tomorrow's focus too?`
  }
  const prompts = [
    `Nice — ${timerMinutes} minutes locked in. What did you make progress on? Naming it reinforces the win.`,
    `Session ${sessionCount} done! ✅ Was there a moment you wanted to check your phone? Noticing that impulse is half the battle.`,
    `Another ${timerMinutes} minutes banked. You're building momentum. What's the priority for your next session?`,
    `${totalMinutes} total minutes today. You're in the top 5% of people who actually follow through. What's next?`,
  ]
  return prompts[(sessionCount - 1) % prompts.length]
}

export default function FocusTimerView({ focusSessions, onSessionComplete, onAICoach }: Props) {
  const [preset, setPreset] = useState(0)
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].focus * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsToday, setSessionsToday] = useState(0)
  const [minutesToday, setMinutesToday] = useState(0)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [activeSound, setActiveSound] = useState('none')
  const [showSounds, setShowSounds] = useState(false)
  const [coachingMessage, setCoachingMessage] = useState('')
  const [showStats, setShowStats] = useState(true)
  const [activeElapsed, setActiveElapsed] = useState(0) // seconds elapsed in current focus session
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionStartRef = useRef<number>(0) // timestamp when current focus session started
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<{ start: () => void; stop: () => void } | null>(null)

  const config = PRESETS[preset]

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const s = focusSessions.find(s => s.date === today)
    if (s) { setSessionsToday(s.count); setMinutesToday(s.minutes) }
  }, [focusSessions])

  const startSound = useCallback((soundId: string) => {
    noiseRef.current?.stop()
    if (soundId === 'none') return
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    const gen = createNoiseGenerator(soundId, audioCtxRef.current)
    gen.start()
    noiseRef.current = gen
  }, [])

  const stopSound = useCallback(() => { noiseRef.current?.stop(); noiseRef.current = null }, [])

  useEffect(() => {
    if (isRunning && timerState === 'focus' && activeSound !== 'none') startSound(activeSound)
    else stopSound()
    return () => stopSound()
  }, [isRunning, timerState, activeSound])

  useEffect(() => () => { stopSound(); try { audioCtxRef.current?.close() } catch {} }, [])

  const stopTimer = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current); setIsRunning(false) }, [])
  const startTimer = useCallback(() => {
    setIsRunning(true)
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => { if (prev <= 1) { stopTimer(); return 0 } return prev - 1 })
    }, 1000)
  }, [stopTimer])

  useEffect(() => {
    if (secondsLeft === 0 && timerState !== 'idle' && timerState !== 'coaching') {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(timerState === 'focus' ? '🎯 Focus session complete!' : '☕ Break is over!', {
            body: timerState === 'focus' ? 'Great work! Take a well-deserved break.' : 'Ready to focus again?', icon: '/icon-192.png',
          })
        }
      } catch {}

      // Gentle chime
      try {
        const ctx = audioCtxRef.current || new AudioContext()
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = timerState === 'focus' ? 523 : 440
        g.gain.value = 0.3; g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5)
        osc.connect(g); g.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 1.5)
      } catch {}

      if (timerState === 'focus') {
        onSessionComplete(config.focus)
        const newCount = pomodoroCount + 1
        setPomodoroCount(newCount)
        const newMinutes = minutesToday + config.focus
        setSessionsToday(prev => prev + 1)
        setMinutesToday(newMinutes)
        setActiveElapsed(0)
        sessionStartRef.current = 0
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
        const coaching = getCoachingPrompt(newCount, newMinutes, config.focus)
        setCoachingMessage(coaching)
        setTimerState('coaching')
        if (onAICoach) onAICoach(`⏱️ Focus session #${newCount} complete (${config.focus} min). Total today: ${newMinutes} min.\n\n${coaching}`)
      } else {
        setTimerState('idle'); setSecondsLeft(config.focus * 60)
      }
    }
  }, [secondsLeft, timerState, config, pomodoroCount, minutesToday, onSessionComplete, onAICoach, startTimer])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current) }, [])

  const handleStartPause = () => {
    if (isRunning) {
      // PAUSING — give partial credit if focused for 2+ minutes
      stopTimer()
      if (timerState === 'focus') {
        const elapsedMin = Math.floor(activeElapsed / 60)
        if (elapsedMin >= 2) {
          onSessionComplete(elapsedMin)
          setSessionsToday(prev => prev + 1)
          setMinutesToday(prev => prev + elapsedMin)
        }
      }
      // Stop elapsed tracker
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
    } else {
      if (timerState === 'idle' || timerState === 'coaching') {
        setTimerState('focus')
        setCoachingMessage('')
        setSecondsLeft(config.focus * 60)
        setActiveElapsed(0)
        sessionStartRef.current = Date.now()
      }
      // Start elapsed tracker (updates every second for live display)
      if (timerState === 'focus' || timerState === 'idle' || timerState === 'coaching') {
        sessionStartRef.current = sessionStartRef.current || Date.now()
        elapsedIntervalRef.current = setInterval(() => {
          setActiveElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000))
        }, 1000)
      }
      startTimer()
    }
  }

  const handleDismissCoaching = (startBreak: boolean) => {
    setCoachingMessage('')
    if (startBreak) {
      setTimerState(pomodoroCount % 4 === 0 ? 'longBreak' : 'break')
      setSecondsLeft((pomodoroCount % 4 === 0 ? config.longBreak : config.break) * 60)
      setTimeout(() => startTimer(), 300)
    } else { setTimerState('focus'); setSecondsLeft(config.focus * 60) }
  }

  const handleReset = () => {
    stopTimer()
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
    setTimerState('idle')
    setSecondsLeft(config.focus * 60)
    setCoachingMessage('')
    setActiveElapsed(0)
    sessionStartRef.current = 0
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const total = timerState === 'focus' ? config.focus * 60 : timerState === 'break' ? config.break * 60 : timerState === 'longBreak' ? config.longBreak * 60 : config.focus * 60
  const progress = timerState === 'coaching' ? 100 : total > 0 ? ((total - secondsLeft) / total) * 100 : 0

  const stateColors: Record<string, string> = { idle: 'from-stone-50 to-stone-100', focus: 'from-red-50 to-orange-50', break: 'from-emerald-50 to-teal-50', longBreak: 'from-blue-50 to-indigo-50', coaching: 'from-amber-50 to-yellow-50' }
  const stateLabels: Record<string, string> = { idle: 'Ready to focus', focus: 'Deep focus', break: 'Short break', longBreak: 'Long break — you earned it!', coaching: 'Session complete!' }

  const getStreak = () => {
    let s = 0; const t = new Date()
    for (let i = 0; i < 30; i++) { const d = new Date(t); d.setDate(t.getDate() - i); if (focusSessions.some(x => x.date === d.toISOString().split('T')[0] && x.count > 0)) s++; else if (i > 0) break }
    return s
  }

  const totalAllTime = focusSessions.reduce((a, b) => a + b.minutes, 0)
  const totalSessions = focusSessions.reduce((a, b) => a + b.count, 0)
  const avgDaily = focusSessions.length > 0 ? Math.round(totalAllTime / Math.min(focusSessions.length, 30)) : 0

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className={`bg-gradient-to-b ${stateColors[timerState]} rounded-3xl p-8 text-center mb-4 shadow-sm border border-stone-100`}>
        <p className="text-sm font-medium text-stone-500 mb-1 flex items-center justify-center gap-1.5">
          {timerState === 'focus' && <Brain className="w-4 h-4 text-red-400" />}
          {(timerState === 'break' || timerState === 'longBreak') && <Coffee className="w-4 h-4 text-emerald-400" />}
          {timerState === 'idle' && <Timer className="w-4 h-4 text-stone-400" />}
          {timerState === 'coaching' && <MessageCircle className="w-4 h-4 text-amber-500" />}
          {stateLabels[timerState]}
        </p>

        {timerState === 'coaching' && coachingMessage ? (
          <div className="my-4">
            <p className="text-sm text-stone-700 leading-relaxed mb-5 px-2">{coachingMessage}</p>
            <div className="flex gap-3">
              <button onClick={() => handleDismissCoaching(true)} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm shadow-md hover:bg-emerald-600 transition-all">☕ Take break</button>
              <button onClick={() => handleDismissCoaching(false)} className="flex-1 py-3 rounded-xl bg-stone-800 text-white font-medium text-sm shadow-md hover:bg-stone-700 transition-all">🔥 Keep going</button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-7xl font-extralight text-stone-800 tracking-tight my-6" style={{ fontFamily: "'Georgia', serif", fontVariantNumeric: 'tabular-nums' }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div className="w-full h-1.5 bg-stone-200/50 rounded-full overflow-hidden mb-6">
              <div className={`h-full rounded-full transition-all duration-1000 ${timerState === 'focus' ? 'bg-red-400' : timerState === 'break' ? 'bg-emerald-400' : timerState === 'longBreak' ? 'bg-blue-400' : 'bg-stone-300'}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={handleReset} className="p-3 rounded-full bg-white/80 text-stone-500 hover:bg-white hover:text-stone-700 transition-all shadow-sm"><RotateCcw className="w-5 h-5" /></button>
              <button onClick={handleStartPause} className={`p-5 rounded-full shadow-lg transition-all ${isRunning ? 'bg-stone-800 text-white hover:bg-stone-700' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'}`}>
                {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
              </button>
              <button onClick={() => setShowSounds(!showSounds)} className={`p-3 rounded-full transition-all shadow-sm ${activeSound !== 'none' ? 'bg-amber-100 text-amber-600' : 'bg-white/80 text-stone-500 hover:bg-white hover:text-stone-700'}`}>
                {activeSound !== 'none' ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
          </>
        )}

        {timerState !== 'coaching' && (
          <div className="flex items-center justify-center gap-2 mt-5">
            {[0,1,2,3].map(i => (<div key={i} className={`w-3 h-3 rounded-full transition-all ${i < (pomodoroCount % 4) ? 'bg-amber-500 scale-110' : 'bg-stone-200'}`} />))}
            <span className="text-xs text-stone-400 ml-2">{pomodoroCount % 4}/4 until long break</span>
          </div>
        )}
      </div>

      {showSounds && (
        <div className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-800 text-sm flex items-center gap-2"><Volume2 className="w-4 h-4 text-amber-500" />Ambient Sounds</h3>
            <button onClick={() => setShowSounds(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SOUNDS.map(sound => (
              <button key={sound.id} onClick={() => { setActiveSound(sound.id); if (isRunning && timerState === 'focus') { stopSound(); if (sound.id !== 'none') startSound(sound.id) } }}
                className={`py-3 rounded-xl text-center transition-all ${activeSound === sound.id ? 'bg-amber-500 text-white shadow-md' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'}`}>
                <span className="text-lg block">{sound.emoji}</span>
                <span className="text-[11px] font-medium">{sound.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-stone-400 mt-2 text-center">Sounds play during focus sessions only</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => { if (!isRunning) { setPreset(i); setSecondsLeft(p.focus * 60); setTimerState('idle') } }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${preset === i ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm mb-4">
        <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" />Today's Focus</h3>
        
        {/* Live session indicator */}
        {(isRunning && timerState === 'focus') && (
          <div className="bg-red-50 rounded-xl p-3 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-700">Focusing now — {Math.floor(activeElapsed / 60)}m {activeElapsed % 60}s elapsed</span>
          </div>
        )}
        {(!isRunning && timerState === 'focus' && activeElapsed > 0) && (
          <div className="bg-amber-50 rounded-xl p-3 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-amber-700">Paused — {Math.floor(activeElapsed / 60)}m elapsed{activeElapsed >= 120 ? ' (partial credit logged)' : ''}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center"><p className="text-2xl font-bold text-stone-800">{sessionsToday}</p><p className="text-xs text-stone-500">sessions</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-stone-800">{minutesToday + (isRunning && timerState === 'focus' ? Math.floor(activeElapsed / 60) : 0)}</p><p className="text-xs text-stone-500">minutes</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-amber-600">{getStreak() > 0 ? `🔥 ${getStreak()}` : '—'}</p><p className="text-xs text-stone-500">day streak</p></div>
        </div>
        <div className="mt-4">
          {(() => { const totalMin = minutesToday + (isRunning && timerState === 'focus' ? Math.floor(activeElapsed / 60) : 0); return (<>
            <div className="flex justify-between text-xs text-stone-500 mb-1"><span>Daily goal: 120 min</span><span>{Math.min(100, Math.round((totalMin / 120) * 100))}%</span></div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${totalMin >= 120 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (totalMin / 120) * 100)}%` }} />
            </div>
          </>) })()}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm mb-4 overflow-hidden">
        <button onClick={() => setShowStats(!showStats)} className="w-full p-5 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800 text-sm">Focus Insights</h3>
          {showStats ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </button>
        {showStats && (
          <div className="px-5 pb-5 -mt-2">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-stone-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-stone-800">{Math.round(totalAllTime / 60)}h</p><p className="text-[10px] text-stone-500">total focused</p></div>
              <div className="bg-stone-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-stone-800">{totalSessions}</p><p className="text-[10px] text-stone-500">all sessions</p></div>
              <div className="bg-stone-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-stone-800">{avgDaily}m</p><p className="text-[10px] text-stone-500">avg / day</p></div>
            </div>
            <p className="text-xs font-medium text-stone-500 mb-2">This Week</p>
            <div className="flex gap-1.5">
              {(() => {
                const today = new Date(); const dow = today.getDay(); const days = ['S','M','T','W','T','F','S']
                return days.map((label, i) => {
                  const d = new Date(today); d.setDate(today.getDate() - dow + i)
                  const ds = d.toISOString().split('T')[0]; const sess = focusSessions.find(s => s.date === ds)
                  const m = sess?.minutes || 0; const it = ds === today.toISOString().split('T')[0]
                  const bh = Math.min(100, Math.max(8, (m / 120) * 100))
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-14 bg-stone-50 rounded-lg flex items-end justify-center overflow-hidden">
                        <div className={`w-full rounded-t-md transition-all ${m > 0 ? 'bg-amber-400' : ''}`} style={{ height: `${bh}%` }} />
                      </div>
                      <span className={`text-[10px] font-semibold ${it ? 'text-amber-600' : 'text-stone-400'}`}>{label}</span>
                      {m > 0 && <span className="text-[9px] text-stone-400">{m}m</span>}
                    </div>
                  )
                })
              })()}
            </div>
            {focusSessions.length > 0 && (() => {
              const best = focusSessions.reduce((a, b) => a.minutes > b.minutes ? a : b)
              return <p className="text-[11px] text-stone-400 mt-3 text-center">Best day: {new Date(best.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {best.minutes} min across {best.count} sessions</p>
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

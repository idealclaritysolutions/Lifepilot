import {
  Sparkles, ArrowRight, MessageCircle, ListTodo, BookOpen, Repeat,
  Users, ListChecks, Timer, ShieldCheck, CreditCard, Smartphone, Check
} from 'lucide-react'

interface Props {
  onStart: () => void
  onSignIn: () => void
}

const FEATURES = [
  {
    icon: MessageCircle,
    color: 'bg-amber-100 text-amber-700',
    title: 'AI Chat that knows your life',
    desc: 'Type or speak what\'s on your mind. Life Pilot turns it into tasks, reminders, and plans — tailored to you.',
  },
  {
    icon: ListTodo,
    color: 'bg-blue-100 text-blue-700',
    title: 'Life Board for tasks',
    desc: 'My Day, Prioritize, and My Goals views keep everything you need to do in one calm place.',
  },
  {
    icon: BookOpen,
    color: 'bg-rose-100 text-rose-700',
    title: 'Journal — write or speak',
    desc: 'Capture thoughts by typing or voice. Search past entries, and let the AI pull action items out for you.',
  },
  {
    icon: Repeat,
    color: 'bg-emerald-100 text-emerald-700',
    title: 'Habits & streaks',
    desc: 'Build better habits with daily tracking, streaks, and insights. Available on Inner Circle & Guided.',
  },
  {
    icon: Users,
    color: 'bg-pink-100 text-pink-700',
    title: 'People & important dates',
    desc: 'Birthdays, anniversaries, and the people who matter — remembered, so you never miss a moment.',
  },
  {
    icon: ListChecks,
    color: 'bg-purple-100 text-purple-700',
    title: 'Shared Lists',
    desc: 'Grocery runs, errands, and family planning you can share. Available on Inner Circle & Guided plans.',
  },
  {
    icon: Timer,
    color: 'bg-orange-100 text-orange-700',
    title: 'Focus Timer',
    desc: 'Pomodoro-style focus sessions (25/5, 50/10, 15/3) with daily focus insights.',
  },
  {
    icon: Sparkles,
    color: 'bg-amber-100 text-amber-700',
    title: 'Daily nudges & recaps',
    desc: 'Gentle reminders, weekly recaps, and coaching-style reflections based on your journal themes.',
  },
]

const PLANS = [
  {
    name: 'Clarity Starter',
    price: 'Free',
    note: 'Start here — no card, no account needed',
    points: ['10 AI messages/day', '5 journal entries/month', 'Life board & basic nudges'],
  },
  {
    name: 'Life Pilot',
    price: '$16.99/mo',
    note: 'or $159/yr (save 22%) — Most popular',
    points: ['40 AI messages/day', '20 journal entries/month + voice', 'Theme detection & weekly recaps'],
  },
  {
    name: 'Inner Circle',
    price: '$34.99/mo',
    note: 'or $327.51/yr (save 22%)',
    points: ['100 AI messages/day', 'Unlimited journal + voice', 'Shared Lists & habit tracking'],
  },
  {
    name: 'Guided',
    price: '$129.99/mo',
    note: 'Everything, plus a human coach',
    points: ['300 AI messages/day', 'Monthly 30-min 1-on-1 coaching call', 'Weekly coach check-ins & reports'],
  },
]

const FAQS = [
  {
    q: 'Is there a free plan?',
    a: 'Yes. Clarity Starter is free, and every new user gets a 7-day trial of Inner Circle premium on launch — no credit card needed. You only upgrade if you want more.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. You can start using Life Pilot AI right away and your data stays on your device. Creating a free account (Google or email) is optional and enables encrypted cloud sync.',
  },
  {
    q: 'Which plans include Shared Lists and habit tracking?',
    a: 'Shared Lists and habit tracking are included on the Inner Circle and Guided plans. The free Clarity Starter plan and the Life Pilot plan do not include them — the plan cards in the app mark exactly what is and isn\'t included on each plan.',
  },
  {
    q: 'Is Life Pilot AI an app I download?',
    a: 'It\'s a web app — it works right in your browser at getlifepilot.app, with nothing to download. You can add it to your phone\'s home screen for an app-like experience.',
  },
  {
    q: 'Is my data used to train AI?',
    a: 'No. Your data is used only to provide the service. We do not sell your data or use it to train AI models. See the Privacy Policy for details.',
  },
  {
    q: 'How do I cancel?',
    a: 'Paid subscriptions are billed through Stripe, monthly or annually. You can cancel at any time and your plan stays active until the end of the current billing period. Refunds are handled on a case-by-case basis — see the Terms of Service.',
  },
]

export function LandingPage({ onStart, onSignIn }: Props) {
  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6]">
      {/* Top bar */}
      <header className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-200 to-orange-300">
            <Sparkles className="w-5 h-5 text-amber-800" />
          </span>
          <span className="font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Life Pilot AI</span>
        </div>
        <button onClick={onSignIn} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
          Sign in
        </button>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-5 pt-8 pb-10">
        <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mb-5">
          🎁 7-day free trial of Inner Circle — no credit card
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4" style={{ fontFamily: "'Georgia', serif" }}>
          Meet Life Pilot AI
        </h1>
        <p className="text-xl text-stone-500 mb-3 leading-relaxed">
          Your AI co-pilot for everything life throws at you.
        </p>
        <p className="text-stone-400 mb-8 max-w-xl mx-auto leading-relaxed">
          Think of me as that impossibly organized friend who always knows what to do, what's due, and what's for dinner — one app for your tasks, habits, journal, people, and plans, instead of a head full of mental notes and 10 different apps.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <button
            onClick={onStart}
            className="w-full sm:w-auto inline-flex items-center justify-center bg-stone-900 hover:bg-stone-800 text-white px-8 py-4 text-lg rounded-2xl font-medium"
          >
            Start free <ArrowRight className="ml-2 w-5 h-5" />
          </button>
          <a
            href="#pricing"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-white border border-stone-200 hover:border-stone-300 text-stone-700 px-8 py-4 text-lg rounded-2xl font-medium"
          >
            See plans & pricing
          </a>
        </div>
        <p className="text-sm text-stone-400">
          Already have an account?{' '}
          <button onClick={onSignIn} className="text-amber-600 font-semibold hover:text-amber-700">Sign in</button>
        </p>

        {/* Trust strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 text-left">
          {[
            { icon: CreditCard, text: 'Free plan included — no card to start' },
            { icon: ShieldCheck, text: 'Your data stays on your device unless you choose sync' },
            { icon: Smartphone, text: 'Works in your browser — nothing to download' },
            { icon: Check, text: 'Cancel anytime — plans run to the end of the period' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="bg-white rounded-2xl border border-stone-100 p-3.5 flex gap-2.5 items-start">
              <Icon className="w-5 h-5 text-amber-600 flex-none mt-0.5" />
              <span className="text-xs text-stone-600 leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 text-center mb-2" style={{ fontFamily: "'Georgia', serif" }}>
          Everything life throws at you, in one place
        </h2>
        <p className="text-stone-400 text-center mb-8 max-w-lg mx-auto">
          Tell Life Pilot what's going on — by typing or speaking — and it helps you handle it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-stone-800 mb-1.5">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 text-center mb-8" style={{ fontFamily: "'Georgia', serif" }}>
          How it works
        </h2>
        <div className="space-y-4">
          {[
            { n: '1', title: 'Tell Life Pilot what\'s on your mind', desc: 'Type or speak — a task, a worry, a plan, a 2AM idea. No account or download needed to start.' },
            { n: '2', title: 'It organizes everything for you', desc: 'Thoughts become organized tasks, journal entries with action items, reminders for the people you love, and a board that shows what matters today.' },
            { n: '3', title: 'Start free, upgrade only if you want more', desc: 'Clarity Starter is free, and you get 7 days of Inner Circle premium on launch. Paid plans add higher limits, voice journaling, Shared Lists, habit tracking, reports, and coaching.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="bg-white rounded-2xl border border-stone-100 p-5 flex gap-4 shadow-sm">
              <span className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold flex-none">{n}</span>
              <div>
                <h3 className="font-semibold text-stone-800 mb-1">{title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 text-center mb-2" style={{ fontFamily: "'Georgia', serif" }}>
          Plans & pricing
        </h2>
        <p className="text-stone-400 text-center mb-8 max-w-lg mx-auto">
          Start free. Every new user gets a 7-day Inner Circle trial — no credit card. Full plan details and subscribing are inside the app.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div key={plan.name} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm flex flex-col">
              <h3 className="font-bold text-stone-800">{plan.name}</h3>
              <p className="text-lg text-amber-600 font-semibold mt-1">{plan.price}</p>
              <p className="text-xs text-stone-400 mb-4">{plan.note}</p>
              <div className="space-y-2">
                {plan.points.map(p => (
                  <div key={p} className="flex items-start gap-2 text-sm text-stone-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-none mt-0.5" /><span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6 md:p-8 text-center">
          <h2 className="text-2xl font-bold text-stone-900 mb-3" style={{ fontFamily: "'Georgia', serif" }}>
            Built for overwhelmed humans
          </h2>
          <p className="text-stone-600 leading-relaxed max-w-xl mx-auto mb-4">
            Life Pilot AI is built by Ideal Clarity Solutions. It started with a simple problem: your brain was never meant to remember everything — bills, birthdays, groceries, appointments, wins, and 2AM ideas. Life Pilot is the external brain that holds it all, so your head can be quiet again.
          </p>
          <p className="text-sm text-stone-500">
            Questions? Email us at{' '}
            <a href="mailto:support@getlifepilot.app" className="text-amber-700 font-semibold hover:text-amber-800">support@getlifepilot.app</a>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 text-center mb-8" style={{ fontFamily: "'Georgia', serif" }}>
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="bg-white rounded-2xl border border-stone-100 px-5 py-4 shadow-sm">
              <summary className="font-semibold text-stone-800 cursor-pointer">{q}</summary>
              <p className="text-sm text-stone-500 leading-relaxed mt-2">{a}</p>
            </details>
          ))}
        </div>
        <div className="text-center mt-10">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center bg-stone-900 hover:bg-stone-800 text-white px-8 py-4 text-lg rounded-2xl font-medium"
          >
            Start free <ArrowRight className="ml-2 w-5 h-5" />
          </button>
          <p className="text-xs text-stone-400 mt-3">Free plan included · 7-day Inner Circle trial · No credit card to start</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-6">
        <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-stone-400">
          <span>© Ideal Clarity Solutions · Life Pilot AI</span>
          <div className="flex items-center gap-5">
            <a href="/privacy.html" className="hover:text-stone-600">Privacy Policy</a>
            <a href="/terms.html" className="hover:text-stone-600">Terms of Service</a>
            <a href="mailto:support@getlifepilot.app" className="hover:text-stone-600">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'

interface Props {
  page: 'privacy' | 'terms'
  onClose: () => void
}

export function LegalPage({ page, onClose }: Props) {
  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 sticky top-0 bg-[#FAF9F6] z-10">
        <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>
          {page === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <X className="w-5 h-5 text-stone-400" />
        </button>
      </div>

      <div className="px-5 py-6 max-w-lg mx-auto">
        {page === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        <p className="text-xs text-stone-400 mt-8 text-center">Last updated: March 2, 2026</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-stone-800 mb-2">{title}</h2>
      <div className="text-sm text-stone-600 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function PrivacyContent() {
  return (
    <>
      <p className="text-sm text-stone-600 leading-relaxed mb-6">
        Life Pilot AI ("we," "our," or "the app") is operated by Ideal Clarity Solutions. We take your privacy seriously. This policy explains what data we collect, how we use it, and your rights.
      </p>

      <Section title="1. What Data We Collect">
        <p>When you use Life Pilot AI, you may provide the following information:</p>
        <p><strong>Account information:</strong> Your name, email address, and authentication credentials when you create an account.</p>
        <p><strong>Journal entries:</strong> Text and voice transcriptions you write in the Journal tab, including mood selections and any themes detected.</p>
        <p><strong>Chat messages:</strong> Conversations you have with the Life Pilot AI assistant.</p>
        <p><strong>Life board items:</strong> Tasks, reminders, and to-do items you create or that the AI creates on your behalf.</p>
        <p><strong>People & events:</strong> Names, relationships, birthdays, anniversaries, and notes about people you add to the People tab.</p>
        <p><strong>Habits:</strong> Habit names and completion records.</p>
        <p><strong>Location data:</strong> Your approximate location, only when you explicitly enable location services in Settings. This is used solely to provide nearby store and service recommendations.</p>
        <p><strong>Documents:</strong> Photos or files you upload for AI analysis (e.g., bills, receipts).</p>
        <p><strong>Device information:</strong> Browser type, operating system, and device type for compatibility purposes.</p>
      </Section>

      <Section title="2. Where Your Data Is Stored">
        <p><strong>On your device:</strong> The majority of your data (journal entries, board items, people, habits, chat history) is stored locally on your device using browser storage (localStorage). We do not have access to this data on our servers.</p>
        <p><strong>When you have an account:</strong> If you create an account and enable cloud sync, your data is stored in a secure database hosted by our infrastructure provider (Vercel/Supabase) with encryption at rest.</p>
        <p><strong>AI processing:</strong> When you send a chat message or upload a document, that content is transmitted over HTTPS (encrypted in transit) to Anthropic's Claude API for processing. Anthropic processes the message to generate a response and does not use your data to train their models. See Anthropic's privacy policy at anthropic.com/privacy for details.</p>
      </Section>

      <Section title="3. How We Use Your Data">
        <p>We use your data exclusively to provide and improve the Life Pilot AI service:</p>
        <p>• To generate AI responses tailored to your life context</p>
        <p>• To detect journal themes and provide coaching reflections</p>
        <p>• To send you push notifications about tasks, reminders, and events</p>
        <p>• To provide location-based recommendations when location is enabled</p>
        <p>• To manage your subscription and account</p>
        <p>We do <strong>not</strong> sell your data. We do <strong>not</strong> share your data with advertisers. We do <strong>not</strong> use your data to train AI models.</p>
      </Section>

      <Section title="4. Third-Party Services">
        <p><strong>Anthropic (Claude AI):</strong> Chat messages and uploaded documents are sent to Anthropic's API for processing. Anthropic's data handling is governed by their privacy policy and their commercial API terms, which prohibit using customer data for model training.</p>
        <p><strong>Vercel:</strong> Our app is hosted on Vercel's infrastructure. Vercel processes standard web requests (IP addresses, request metadata) as part of hosting.</p>
        <p><strong>Google Maps:</strong> When location features are used, links are generated that direct you to Google Maps. We do not send your data to Google — the Maps links are constructed in your browser.</p>
        <p><strong>Stripe:</strong> If you purchase a subscription, payment is processed by Stripe. We never see or store your full credit card number. Stripe's privacy policy governs payment data.</p>
      </Section>

      <Section title="5. Your Rights">
        <p><strong>Access:</strong> You can view all your data within the app at any time.</p>
        <p><strong>Deletion:</strong> You can delete all your data by using the "Reset Everything" button in Settings. This permanently removes all locally stored data. If you have an account, you can request full account deletion by contacting us.</p>
        <p><strong>Portability:</strong> You can export your journal entries to PDF from within the app.</p>
        <p><strong>Opt-out:</strong> You can disable location services, push notifications, and cloud sync at any time in Settings.</p>
        <p><strong>California residents (CCPA):</strong> You have the right to know what data we collect, request deletion, and opt out of any sale of data (we don't sell data).</p>
        <p><strong>EU residents (GDPR):</strong> You have rights to access, rectification, erasure, data portability, and restriction of processing. Our legal basis for processing is your consent (which you can withdraw at any time) and legitimate interest in providing the service.</p>
      </Section>

      <Section title="6. Data Security">
        <p>We use HTTPS encryption for all data in transit. Locally stored data is protected by your device's security measures. We implement rate limiting and authentication on our API endpoints to prevent unauthorized access. However, no system is 100% secure, and we cannot guarantee absolute security.</p>
      </Section>

      <Section title="7. Children's Privacy">
        <p>Life Pilot AI is not intended for children under 13 (or under 16 in the EU). We do not knowingly collect data from children. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>
      </Section>

      <Section title="8. Changes to This Policy">
        <p>We may update this policy from time to time. We will notify you of significant changes through the app. Continued use of Life Pilot AI after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <Section title="9. Contact Us">
        <p>For privacy questions, data requests, or concerns:</p>
        <p>Ideal Clarity Solutions<br/>Email: idealclaritysolutions@gmail.com<br/>Website: idealclarity.com</p>
      </Section>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p className="text-sm text-stone-600 leading-relaxed mb-6">
        These Terms of Service ("Terms") govern your use of Life Pilot AI, operated by Ideal Clarity Solutions. By using Life Pilot AI, you agree to these Terms.
      </p>

      <Section title="1. The Service">
        <p>Life Pilot AI is an AI-powered life management application that provides task management, journaling, habit tracking, people management, and AI-assisted conversation. The service is provided "as is" and "as available."</p>
      </Section>

      <Section title="2. Eligibility">
        <p>You must be at least 13 years old (or 16 in the EU) to use Life Pilot AI. By using the app, you represent that you meet this age requirement.</p>
      </Section>

      <Section title="3. Accounts & Subscriptions">
        <p><strong>Free tier:</strong> Life Pilot AI offers a free tier with limited features (10 AI messages/day, 5 journal entries/month, 3 people).</p>
        <p><strong>Paid tiers:</strong> Life Pilot ($9.99/month), Inner Circle ($19.99/month), and Guided ($79.99/month) offer additional features as described on the pricing page.</p>
        <p><strong>Promo codes:</strong> Promotional codes may be offered at our discretion and can be revoked or modified at any time.</p>
        <p><strong>Billing:</strong> Paid subscriptions are billed monthly or annually through Stripe. You may cancel at any time. Cancellation takes effect at the end of the current billing period. Refunds are handled on a case-by-case basis.</p>
      </Section>

      <Section title="4. AI Disclaimer">
        <p><strong>Life Pilot AI's AI assistant is not a licensed therapist, doctor, lawyer, or financial advisor.</strong> The journal coaching, task suggestions, and conversational responses are generated by artificial intelligence and should not be treated as professional medical, legal, financial, or therapeutic advice.</p>
        <p>If you are experiencing a mental health crisis, please contact the 988 Suicide & Crisis Lifeline (call or text 988) or your local emergency services.</p>
        <p>AI responses may occasionally be inaccurate, incomplete, or inappropriate. Use your own judgment when acting on AI suggestions.</p>
      </Section>

      <Section title="5. Your Content">
        <p>You retain ownership of all content you create in Life Pilot AI (journal entries, tasks, notes, etc.). We do not claim any ownership rights over your content.</p>
        <p>You grant us a limited license to process your content solely for the purpose of providing the Life Pilot AI service (e.g., sending your messages to the AI for processing, detecting journal themes).</p>
      </Section>

      <Section title="6. Acceptable Use">
        <p>You agree not to:</p>
        <p>• Attempt to gain unauthorized access to the service or other users' data</p>
        <p>• Use the service to generate harmful, illegal, or abusive content</p>
        <p>• Reverse engineer, decompile, or attempt to extract the source code</p>
        <p>• Circumvent usage limits or subscription restrictions</p>
        <p>• Use automated tools to send excessive requests to our API</p>
      </Section>

      <Section title="7. Data & Privacy">
        <p>Your use of Life Pilot AI is also governed by our Privacy Policy. By using the service, you consent to the data practices described therein.</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>To the maximum extent permitted by law, Ideal Clarity Solutions shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or personal injury arising from your use of Life Pilot AI.</p>
        <p>We are not responsible for data loss resulting from device failure, browser data clearing, or any other cause outside our direct control. We strongly recommend maintaining your own backups of important information.</p>
      </Section>

      <Section title="9. Service Availability">
        <p>We strive to maintain high availability but do not guarantee uninterrupted service. We may modify, suspend, or discontinue features at any time with reasonable notice. Scheduled maintenance will be communicated in advance when possible.</p>
      </Section>

      <Section title="10. Changes to Terms">
        <p>We may update these Terms from time to time. Continued use of Life Pilot AI after changes constitutes acceptance. For material changes, we will provide notice through the app.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by the laws of the State of Arkansas, United States, without regard to conflict of law principles.</p>
      </Section>

      <Section title="12. Contact">
        <p>For questions about these Terms:</p>
        <p>Ideal Clarity Solutions<br/>Email: idealclaritysolutions@gmail.com<br/>Website: idealclarity.com</p>
      </Section>
    </>
  )
}

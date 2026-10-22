// Authentication API endpoint
// Currently supports: promo code validation (server-side)
// Future: email auth, Stripe webhook, subscription management

// In-memory store for validated subscriptions (production: use database)
const validatedSubs = new Map();

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = origin.includes('vercel.app') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'https://getlifepilot.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  switch (action) {
    case 'validate_promo': {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'No code provided' });

      // All marketing promo codes were retired 2026-10-22. The remaining codes
      // (Google Play reviewer + owner) are validated client-side in src/App.tsx
      // and are intentionally NOT accepted by this server endpoint.
      const PROMO_CODES = {};

      const promo = PROMO_CODES[code.toUpperCase().trim()];
      if (!promo || !promo.active) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      const now = new Date();
      const subscription = {
        tier: promo.tier,
        activatedAt: now.toISOString(),
        expiresAt: promo.durationDays ? new Date(now.getTime() + promo.durationDays * 86400000).toISOString() : null,
        promoCode: code.toUpperCase().trim(),
        label: promo.label,
        validatedServer: true,
      };

      return res.status(200).json({ subscription });
    }

    case 'validate_subscription': {
      // Future: Check subscription status against database/Stripe
      const { subscriptionId } = req.body;
      // For now, return a basic response
      return res.status(200).json({ valid: true, message: 'Subscription validation will be implemented with Stripe integration' });
    }

    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
}

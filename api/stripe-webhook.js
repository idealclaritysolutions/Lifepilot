// Stripe Webhook Handler — validates subscription payments
// Vercel env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_SECRET) {
    console.error('STRIPE_SECRET_KEY not configured')
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  // Map Stripe price IDs to tiers
  const PRICE_TO_TIER = {
    'price_1T6jgGJJZYboQQ44RptMbhgV': 'pro',       // Life Pilot monthly $9.99
    'price_1T6jgGJJZYboQQ449YLr78cu': 'pro',       // Life Pilot annual $79.99
    'price_1T6kUZJJZYboQQ449TpS4q9f': 'premium',   // Inner Circle monthly $19.99
    'price_1T6kUZJJZYboQQ449TpS4q9f': 'premium',   // Inner Circle annual $149.99
    'price_1T6kabJJZYboQQ44iSl3B4l3': 'enterprise', // Guided monthly $79.99
  }

  try {
    const event = req.body

    // Log all webhook events for debugging
    console.log('Stripe webhook:', event.type, event.id)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerEmail = session.customer_email || session.customer_details?.email
        const subscriptionId = session.subscription
        const priceId = session.line_items?.data?.[0]?.price?.id

        console.log('Checkout completed:', {
          email: customerEmail,
          subscription: subscriptionId,
          price: priceId,
        })

        // In a full implementation, you'd:
        // 1. Look up the Clerk user by email
        // 2. Store subscription in your database
        // 3. Sync tier to the user's session
        // For now, log and return success

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const status = subscription.status
        const priceId = subscription.items?.data?.[0]?.price?.id
        const tier = PRICE_TO_TIER[priceId] || 'free'

        console.log('Subscription updated:', { status, tier, priceId })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        console.log('Subscription cancelled:', subscription.id)
        // Reset user to free tier
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        console.log('Payment failed:', invoice.customer_email)
        // Notify user, downgrade after grace period
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(400).json({ error: 'Webhook handling failed' })
  }
}

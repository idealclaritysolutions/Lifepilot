/**
 * revenuecat.ts — RevenueCat (Play Billing) bridge for the native app.
 *
 * Follows the same pattern as lib/native.ts: every public function is a
 * no-op on web, and the plugin is only ever loaded via dynamic import()
 * after isNative() returns true. The web bundle must never load the
 * plugin, and no Purchases.* call may ever execute on web (the plugin's
 * web implementation is a stub).
 *
 * Build 14. Play Console products do NOT exist yet (they can only be
 * created after a billing-enabled AAB is uploaded), so getStoreProducts()
 * returns [] until then and the native paywall degrades gracefully.
 *
 * Only the PUBLIC Android API key belongs here. The RevenueCat secret
 * key must never appear in source — it is only for a future server
 * webhook.
 */

import { isNative } from '@/lib/native'
import type { SubscriptionTier } from '@/App'
import type { CustomerInfo, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor'

// Public (publishable) Android API key — ships in the app by design.
export const REVENUECAT_API_KEY = 'goog_pHQmvCGsVfCyaBJuzpNTHXVyEKy'

export const REVENUECAT_PRODUCT_IDS = [
  'lifepilot_monthly',
  'lifepilot_yearly',
  'innercircle_monthly',
  'innercircle_yearly',
  'guided_monthly',
] as const

// RevenueCat entitlement identifier -> app tier (dashboard identifiers:
// life_pilot "Life Pilot", inner_circle "Inner Circle", guided "Guided").
const ENTITLEMENT_TO_TIER: Record<string, SubscriptionTier> = {
  life_pilot: 'pro',
  inner_circle: 'premium',
  guided: 'enterprise',
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
  enterprise: 3,
}

/** The store tier derived from RevenueCat, or null when nothing is active. */
export interface StoreTierInfo {
  tier: SubscriptionTier
  /** Expiration of the winning entitlement, for display only. */
  expiresAt?: string
}

/** A store product for the paywall. `id` is the plain product id
 * (RevenueCat reports Google Play subscription identifiers as
 * `productId:basePlanId`, e.g. `lifepilot_monthly:p1m` — the suffix is
 * stripped here). `raw` is the full product object needed to purchase. */
export interface StoreProduct {
  id: string
  priceString: string
  title: string
  raw: PurchasesStoreProduct
}

let configured = false

function stripBasePlanSuffix(identifier: string): string {
  return identifier.split(':')[0]
}

function tierFromCustomerInfo(customerInfo: CustomerInfo | null | undefined): StoreTierInfo | null {
  if (!customerInfo) return null
  const active = customerInfo.entitlements?.active || {}
  let best: StoreTierInfo | null = null
  for (const [entitlementId, info] of Object.entries(active)) {
    const tier = ENTITLEMENT_TO_TIER[entitlementId]
    if (!tier) continue
    if (!best || TIER_RANK[tier] > TIER_RANK[best.tier]) {
      best = { tier, expiresAt: info.expirationDate ?? undefined }
    }
  }
  return best
}

async function loadPurchases() {
  return await import('@revenuecat/purchases-capacitor')
}

/**
 * Configure the SDK. Called once from main.tsx (anonymous — no user id
 * yet); the App auth effect then identifies via syncRevenueCatIdentity.
 * Safe to call repeatedly: double-init is guarded by a module flag and
 * Purchases.isConfigured().
 */
export async function initRevenueCat(appUserId?: string | null): Promise<void> {
  if (!isNative()) return
  if (configured) return
  try {
    const { Purchases, LOG_LEVEL } = await loadPurchases()
    try {
      const { isConfigured } = await Purchases.isConfigured()
      if (isConfigured) { configured = true; return }
    } catch { /* fall through to configure */ }
    // WARN for production (was DEBUG while sandbox-testing build 14).
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN })
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: appUserId ?? undefined,
    })
    configured = true
  } catch (err) {
    console.warn('[revenuecat] configure failed:', err)
  }
}

/**
 * Identify the RevenueCat user with the Supabase account id after
 * sign-in, so purchases attach to the account (not an anonymous device
 * id). Signed out → logOut back to an anonymous id. Returns the current
 * store tier afterwards (or null). A logIn transfer failure is logged
 * and swallowed — the anonymous identity keeps the purchase visible
 * rather than losing it; the transfer is re-attempted on the next
 * sign-in. (Anonymous → identified transfer must still be verified in
 * the Play sandbox; see the build-14 smoke checklist.)
 */
export async function syncRevenueCatIdentity(authUser: { id: string } | null): Promise<StoreTierInfo | null> {
  if (!isNative()) return null
  try {
    await initRevenueCat()
    const { Purchases } = await loadPurchases()
    if (authUser) {
      try {
        await Purchases.logIn({ appUserID: authUser.id })
      } catch (err) {
        console.warn('[revenuecat] logIn failed (keeping anonymous identity):', err)
      }
    } else {
      try {
        await Purchases.logOut()
      } catch (err) {
        console.warn('[revenuecat] logOut failed:', err)
      }
    }
    return await refreshEntitlements()
  } catch (err) {
    console.warn('[revenuecat] identity sync failed:', err)
    return null
  }
}

/** Read the current entitlements from RevenueCat. Null = nothing active. */
export async function refreshEntitlements(): Promise<StoreTierInfo | null> {
  if (!isNative()) return null
  try {
    await initRevenueCat()
    const { Purchases } = await loadPurchases()
    const { customerInfo } = await Purchases.getCustomerInfo()
    return tierFromCustomerInfo(customerInfo)
  } catch (err) {
    console.warn('[revenuecat] refreshEntitlements failed:', err)
    return null
  }
}

/**
 * Fetch the 5 store products with their store price strings. Returns []
 * on web, and [] (not a throw) when the Play products don't exist yet —
 * the native paywall must render a graceful "not available yet" state.
 */
export async function getStoreProducts(): Promise<StoreProduct[]> {
  if (!isNative()) return []
  try {
    await initRevenueCat()
    const { Purchases } = await loadPurchases()
    const { products } = await Purchases.getProducts({
      productIdentifiers: [...REVENUECAT_PRODUCT_IDS],
    })
    return (products || []).map((p) => ({
      id: stripBasePlanSuffix(p.identifier),
      priceString: p.priceString,
      title: p.title,
      raw: p,
    }))
  } catch (err) {
    console.warn('[revenuecat] getProducts failed (Play products may not exist yet):', err)
    return []
  }
}

export class PurchaseCancelledError extends Error {
  constructor() {
    super('purchase-cancelled')
    this.name = 'PurchaseCancelledError'
  }
}

export function isPurchaseCancelled(err: unknown): boolean {
  return err instanceof PurchaseCancelledError
}

/**
 * Buy a product. Returns the purchased tier on success, or null when
 * the user cancelled (silent — never shown as an error). Any other
 * failure throws so the caller can show one friendly line.
 *
 * `currentProductId` is the already-owned product being replaced
 * (monthly → yearly change); when omitted it is read from the active
 * subscriptions instead. The change uses WITH_TIME_PRORATION.
 */
export async function purchaseProduct(
  productId: string,
  currentProductId?: string,
): Promise<StoreTierInfo | null> {
  if (!isNative()) return null
  await initRevenueCat()
  const { Purchases, PURCHASES_ERROR_CODE, STORE_REPLACEMENT_MODE } = await loadPurchases()
  const products = await getStoreProducts()
  const product = products.find((p) => p.id === productId)
  if (!product) {
    throw new Error(`Store product not available: ${productId}`)
  }

  // Old product for a subscription change (proration). Prefer the
  // caller's value; otherwise use the currently active subscription.
  let oldProductId = currentProductId ? stripBasePlanSuffix(currentProductId) : undefined
  if (!oldProductId) {
    try {
      const { customerInfo } = await Purchases.getCustomerInfo()
      const active = (customerInfo.activeSubscriptions || [])[0]
      if (active) oldProductId = stripBasePlanSuffix(active)
    } catch { /* no active subscription — plain purchase */ }
  }
  const changeInfo =
    oldProductId && oldProductId !== productId
      ? {
          storeProductChangeInfo: {
            oldProductIdentifier: oldProductId,
            replacementMode: STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION,
          },
        }
      : {}

  try {
    const result = await Purchases.purchaseStoreProduct({
      product: product.raw,
      ...changeInfo,
    })
    // Derive the tier from the purchase result's customer info; fall
    // back to a fresh read if it carries nothing active yet.
    return tierFromCustomerInfo(result.customerInfo) ?? (await refreshEntitlements())
  } catch (err: any) {
    if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return null
    }
    console.warn('[revenuecat] purchase failed:', err?.code ?? err)
    throw err
  }
}

/** Restore previous purchases, then return the active store tier (or null). */
export async function restorePurchases(): Promise<StoreTierInfo | null> {
  if (!isNative()) return null
  try {
    await initRevenueCat()
    const { Purchases } = await loadPurchases()
    await Purchases.restorePurchases()
    return await refreshEntitlements()
  } catch (err) {
    console.warn('[revenuecat] restore failed:', err)
    throw err
  }
}

/**
 * Listen for entitlement changes (renewals, cancellations, expiry,
 * refunds, purchases on another device). Returns the listener id —
 * pass it to removeEntitlementsListener on unmount.
 */
export async function onEntitlementsChanged(
  cb: (tier: StoreTierInfo | null) => void,
): Promise<string | null> {
  if (!isNative()) return null
  try {
    await initRevenueCat()
    const { Purchases } = await loadPurchases()
    const id = await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      cb(tierFromCustomerInfo(customerInfo))
    })
    return id
  } catch (err) {
    console.warn('[revenuecat] addCustomerInfoUpdateListener failed:', err)
    return null
  }
}

export async function removeEntitlementsListener(listenerId: string | null): Promise<void> {
  if (!isNative() || !listenerId) return
  try {
    const { Purchases } = await loadPurchases()
    await Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId })
  } catch { /* listener already gone */ }
}

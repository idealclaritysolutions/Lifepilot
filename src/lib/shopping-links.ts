// ─── Automatic Google Shopping links for Shared List items ──────
// No server call, no API key, no database column: the link is built
// client-side from the item's own text.
//
// Vision (Nov 8): every Shared List item carries a link that takes
// the user to where they can buy that particular item. The link is
// AUTOMATIC — there is deliberately no manual link field anywhere in
// the UI. If an item already has a real saved `link` (e.g. one the
// chatbot attached when it added the item), the UI shows that saved
// link instead and never overwrites it with this generated one.
//
// The URL is a Google Shopping search for the exact item. A search
// (rather than a deep link to one store's product page) is the honest
// client-side option: it shows real, current listings for that item
// and lets the user compare prices, without inventing product URLs
// that might be wrong, stale, or out of stock.

/** Strip the quantity suffix (" ×N") and any packed-meta segments
 *  from item text, leaving just the product itself. */
export function cleanShoppingQuery(itemText: string): string {
  let q = (itemText || '').trim()
  // Trailing quantity suffix, e.g. "Milk ×2" -> "Milk"
  q = q.replace(/\s×\d+$/, '')
  // Packed meta segments are joined with " · " — keep only the
  // first segment if any ever appear in the text.
  q = q.split(' · ')[0].trim()
  return q
}

/** Google Shopping search URL for this item. Falls back to the
 *  Shopping home search when the cleaned query is empty. */
export function shoppingSearchUrl(itemText: string): string {
  const q = cleanShoppingQuery(itemText)
  if (!q) return 'https://www.google.com/search?tbm=shop'
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`
}

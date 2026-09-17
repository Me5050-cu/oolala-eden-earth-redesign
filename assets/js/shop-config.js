// ---------------------------------------------------------------------------
// Shopify connection for the Eden Earth online shop.
//
// Leave storeDomain / storefrontToken empty and the site runs on the demo
// catalog (assets/js/catalog.js), with checkout disabled.
//
// To go live (Shopify admin):
//   1. Settings → Apps and sales channels → Develop apps → Create an app
//      (or install the free "Headless" sales channel).
//   2. Storefront API scopes: unauthenticated_read_product_listings,
//      unauthenticated_read_product_inventory, unauthenticated_write_checkouts,
//      unauthenticated_read_checkouts.
//   3. Copy the public Storefront access token below. It is designed to be
//      public, so it is safe in browser code. Never put an Admin API token here.
//   4. Put the Eden Earth products in a collection and set its handle below.
//   5. Turn on Settings → Shipping and delivery → Local pickup for 714 S Austin Ave.
// ---------------------------------------------------------------------------
window.SHOP_CONFIG = {
  storeDomain: '', // e.g. 'eden-earth.myshopify.com'
  storefrontToken: '', // public Storefront API access token
  apiVersion: '2026-07',
  collectionHandle: 'eden-earth', // falls back to newest products if the collection is missing
};

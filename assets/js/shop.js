// ---------------------------------------------------------------------------
// shop.js — Eden Earth shop: catalog, product dialog and bag.
//
// LIVE (shop-config.js has a domain + token): products come from the Shopify
// Storefront API collection, the bag is a real Shopify cart, and Checkout goes
// to Shopify's hosted checkout (cart.checkoutUrl).
// DEMO: products come from window.EDEN_CATALOG and the bag lives in
// localStorage; Checkout explains that it opens once Shopify is connected.
// ---------------------------------------------------------------------------
(() => {
  const cfg = window.SHOP_CONFIG || {};
  const LIVE = Boolean(cfg.storeDomain && cfg.storefrontToken);
  const CART_KEY = 'oolala.shopifyCartId';
  const DEMO_KEY = 'oolala.demoBag';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const money = ({ amount, currencyCode = 'USD' }) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(Number(amount));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  };

  // --- Storefront API ----------------------------------------------------------
  async function gql(query, variables = {}) {
    const res = await fetch(cfg.endpoint || `https://${cfg.storeDomain}/api/${cfg.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': cfg.storefrontToken },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify responded ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  const PRODUCT = `
    id handle title productType description
    featuredImage { url(transform: { maxWidth: 900 }) altText }
    priceRange { minVariantPrice { amount currencyCode } }
    variants(first: 30) { nodes { id title availableForSale price { amount currencyCode } } }`;

  const CART = `
    fragment CartFields on Cart {
      id checkoutUrl totalQuantity
      cost { subtotalAmount { amount currencyCode } }
      lines(first: 100) { nodes { id quantity
        merchandise { ... on ProductVariant { id title price { amount currencyCode }
          image { url(transform: { maxWidth: 200 }) altText }
          product { title handle featuredImage { url(transform: { maxWidth: 200 }) altText } } } } } }
    }`;

  const categories = window.EDEN_CATEGORIES || {};
  const normalize = (p) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    category: p.productType || 'Collection',
    tagline: categories[p.productType] || '',
    description: p.description || '',
    image: { url: p.featuredImage?.url || '', alt: p.featuredImage?.altText || p.title },
    price: p.priceRange.minVariantPrice,
    variants: p.variants.nodes.map((v) => ({ id: v.id, title: v.title, available: v.availableForSale, price: v.price })),
  });

  async function fetchCatalog() {
    if (!LIVE) return window.EDEN_CATALOG || [];
    const data = await gql(`query($handle: String!) { collection(handle: $handle) { products(first: 60) { nodes { ${PRODUCT} } } } }`, { handle: cfg.collectionHandle });
    let nodes = data.collection?.products.nodes;
    if (!nodes) nodes = (await gql(`{ products(first: 60, sortKey: CREATED_AT, reverse: true) { nodes { ${PRODUCT} } } }`)).products.nodes;
    return nodes.map(normalize);
  }

  // --- bag: one shape for both modes -------------------------------------------------
  // { count, subtotal, checkoutUrl, lines: [{ id, variantId, qty, title, variant, price, image, handle }] }
  let catalog = [];
  const byVariant = () => new Map(catalog.flatMap((p) => p.variants.map((v) => [v.id, { p, v }])));

  const fromShopify = (cart) => ({
    count: cart.totalQuantity,
    subtotal: cart.cost.subtotalAmount,
    checkoutUrl: cart.checkoutUrl,
    lines: cart.lines.nodes.map((l) => ({
      id: l.id,
      variantId: l.merchandise.id,
      qty: l.quantity,
      title: l.merchandise.product.title,
      handle: l.merchandise.product.handle,
      variant: l.merchandise.title === 'Default Title' ? '' : l.merchandise.title,
      price: l.merchandise.price,
      image: l.merchandise.image?.url || l.merchandise.product.featuredImage?.url || '',
    })),
  });

  function demoRead() {
    let raw = [];
    try { raw = JSON.parse(store.get(DEMO_KEY) || '[]'); } catch { raw = []; }
    const index = byVariant();
    const lines = raw.filter((l) => index.has(l.variantId)).map((l) => {
      const { p, v } = index.get(l.variantId);
      return { id: l.variantId, variantId: l.variantId, qty: l.qty, title: p.title, handle: p.handle, variant: v.title === 'Default Title' ? '' : v.title, price: v.price, image: p.image.url };
    });
    const total = lines.reduce((s, l) => s + Number(l.price.amount) * l.qty, 0);
    return { count: lines.reduce((s, l) => s + l.qty, 0), subtotal: { amount: total, currencyCode: 'USD' }, checkoutUrl: '', lines };
  }
  const demoWrite = (lines) => store.set(DEMO_KEY, JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty }))));

  const bagApi = LIVE ? {
    async load() {
      const id = store.get(CART_KEY);
      if (!id) return null;
      const data = await gql(`query($id: ID!) { cart(id: $id) { ...CartFields } } ${CART}`, { id });
      if (!data.cart) { store.del(CART_KEY); return null; }
      return fromShopify(data.cart);
    },
    async add(variantId, qty) {
      const id = store.get(CART_KEY);
      const lines = [{ merchandiseId: variantId, quantity: qty }];
      const data = id
        ? (await gql(`mutation($id: ID!, $lines: [CartLineInput!]!) { r: cartLinesAdd(cartId: $id, lines: $lines) { cart { ...CartFields } userErrors { message } } } ${CART}`, { id, lines }))
        : (await gql(`mutation($lines: [CartLineInput!]!) { r: cartCreate(input: { lines: $lines }) { cart { ...CartFields } userErrors { message } } } ${CART}`, { lines }));
      if (data.r.userErrors.length) throw new Error(data.r.userErrors[0].message);
      store.set(CART_KEY, data.r.cart.id);
      return fromShopify(data.r.cart);
    },
    async update(lineId, qty) {
      const id = store.get(CART_KEY);
      const data = qty > 0
        ? await gql(`mutation($id: ID!, $lines: [CartLineUpdateInput!]!) { r: cartLinesUpdate(cartId: $id, lines: $lines) { cart { ...CartFields } userErrors { message } } } ${CART}`, { id, lines: [{ id: lineId, quantity: qty }] })
        : await gql(`mutation($id: ID!, $ids: [ID!]!) { r: cartLinesRemove(cartId: $id, lineIds: $ids) { cart { ...CartFields } userErrors { message } } } ${CART}`, { id, ids: [lineId] });
      if (data.r.userErrors.length) throw new Error(data.r.userErrors[0].message);
      return fromShopify(data.r.cart);
    },
  } : {
    async load() { return demoRead(); },
    async add(variantId, qty) {
      const bag = demoRead();
      const line = bag.lines.find((l) => l.variantId === variantId);
      if (line) line.qty = Math.min(20, line.qty + qty); else bag.lines.push({ variantId, qty });
      demoWrite(bag.lines);
      return demoRead();
    },
    async update(lineId, qty) {
      const bag = demoRead();
      demoWrite(bag.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)).filter((l) => l.qty > 0));
      return demoRead();
    },
  };

  // --- rendering -------------------------------------------------------------------------
  const cardHtml = (p) => {
    const available = p.variants.some((v) => v.available);
    return `
          <li class="product" data-category="${esc(p.category)}">
            <button class="product-open" type="button" data-product="${esc(p.handle)}">
              <span class="product-media">${p.image.url ? `<img src="${esc(p.image.url)}" alt="${esc(p.image.alt)}" loading="lazy" decoding="async">` : ''}</span>
              <span class="product-meta">
                <span class="product-name">${esc(p.title)}</span>
                <span class="product-price">${money(p.price)}</span>${available ? '' : `
                <span class="product-soldout">Sold out</span>`}
              </span>
            </button>
          </li>`;
  };

  function renderGrids() {
    for (const grid of $$('[data-products]')) {
      const limit = Number(grid.dataset.limit) || catalog.length;
      grid.innerHTML = catalog.slice(0, limit).map(cardHtml).join('');
    }
    buildFilters();
  }

  function buildFilters() {
    const bar = $('[data-filters]');
    if (!bar) return;
    const present = new Set(catalog.map((p) => p.category));
    for (const b of $$('button', bar)) b.hidden = b.dataset.filter !== 'All' && !present.has(b.dataset.filter);
    const known = new Set($$('button', bar).map((b) => b.dataset.filter));
    for (const c of present) if (!known.has(c)) bar.insertAdjacentHTML('beforeend', `<button type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`);
    applyFilter($('[aria-pressed="true"]', bar)?.dataset.filter || 'All');
  }

  function applyFilter(name) {
    const bar = $('[data-filters]');
    if (!bar) return;
    for (const b of $$('button', bar)) b.setAttribute('aria-pressed', String(b.dataset.filter === name));
    for (const li of $$('[data-filterable] .product')) li.hidden = name !== 'All' && li.dataset.category !== name;
    const line = $('[data-filter-tagline]');
    if (line) line.textContent = name === 'All' ? 'Rooted in beauty. Made with intention.' : (categories[name] || '');
  }

  // --- product dialog ---------------------------------------------------------------------
  const pd = $('[data-product-dialog]');
  let current = null;

  function openProduct(handle) {
    const p = catalog.find((x) => x.handle === handle);
    if (!p || !pd) return;
    current = p;
    const img = $('[data-pd-img]', pd);
    img.src = p.image.url; img.alt = p.image.alt;
    $('[data-pd-category]', pd).textContent = p.tagline ? `${p.category} · ${p.tagline}` : p.category;
    $('[data-pd-title]', pd).textContent = p.title;
    $('[data-pd-price]', pd).textContent = money(p.price);
    $('[data-pd-desc]', pd).textContent = p.description;
    const select = $('[data-pd-variant]', pd);
    const multi = p.variants.length > 1;
    $('[data-pd-variant-wrap]', pd).hidden = !multi;
    select.innerHTML = p.variants.map((v) => `<option value="${esc(v.id)}"${v.available ? '' : ' disabled'}>${esc(v.title)}${v.available ? '' : ' (sold out)'}</option>`).join('');
    const firstAvailable = p.variants.find((v) => v.available);
    if (firstAvailable) select.value = firstAvailable.id;
    $('[data-pd-qty]', pd).value = 1;
    const add = $('[data-pd-add]', pd);
    add.disabled = !firstAvailable;
    add.textContent = firstAvailable ? 'Add to bag' : 'Sold out';
    window.OOLALA.openDialog(pd);
  }

  function selectedVariant() {
    if (!current) return null;
    const id = $('[data-pd-variant]', pd).value;
    return current.variants.find((v) => v.id === id) || current.variants[0];
  }

  // --- bag drawer ----------------------------------------------------------------------------
  const drawer = $('[data-bag]');
  let bag = { count: 0, subtotal: { amount: 0, currencyCode: 'USD' }, lines: [], checkoutUrl: '' };

  function renderBag() {
    for (const el of $$('[data-bag-count]')) el.textContent = bag.count;
    if (!drawer) return;
    const body = $('[data-bag-lines]', drawer);
    body.innerHTML = bag.lines.length ? bag.lines.map((l) => `
        <div class="bag-line">
          ${l.image ? `<img src="${esc(l.image)}" alt="" loading="lazy">` : '<span></span>'}
          <div>
            <p class="bag-line-title">${esc(l.title)}</p>
            ${l.variant ? `<p class="bag-line-variant">${esc(l.variant)}</p>` : ''}
            <div class="bag-line-qty">
              <button type="button" data-line="${esc(l.id)}" data-set="${l.qty - 1}" aria-label="Decrease ${esc(l.title)}">−</button>
              <span>${l.qty}</span>
              <button type="button" data-line="${esc(l.id)}" data-set="${Math.min(20, l.qty + 1)}" aria-label="Increase ${esc(l.title)}">+</button>
            </div>
          </div>
          <div class="bag-line-side">
            <span>${money({ amount: Number(l.price.amount) * l.qty, currencyCode: l.price.currencyCode })}</span>
            <button class="text-btn" type="button" data-line="${esc(l.id)}" data-set="0">Remove</button>
          </div>
        </div>`).join('') : '<p class="bag-empty">Your bag is empty.</p>';
    $('[data-bag-subtotal]', drawer).textContent = money(bag.subtotal);
    $('[data-checkout]', drawer).disabled = !bag.count;
  }

  const status = (msg) => { const el = drawer && $('[data-bag-status]', drawer); if (el) el.textContent = msg; };

  async function run(task) {
    try { bag = (await task()) || bag; status(''); }
    catch (err) { console.error(err); status('Something went wrong reaching the shop. Please try again, or call us at (512) 688-5707.'); }
    renderBag();
  }

  // --- events -----------------------------------------------------------------------------------
  document.addEventListener('click', (ev) => {
    const open = ev.target.closest('[data-product]');
    if (open) { openProduct(open.dataset.product); return; }
    const filter = ev.target.closest('[data-filter]');
    if (filter) { applyFilter(filter.dataset.filter); return; }
    if (ev.target.closest('[data-bag-open]')) { status(''); window.OOLALA.openDialog(drawer); return; }
    const line = ev.target.closest('[data-line]');
    if (line) { run(() => bagApi.update(line.dataset.line, Number(line.dataset.set))); return; }
    const qtyBtn = ev.target.closest('[data-qty]');
    if (qtyBtn) {
      const input = $('[data-pd-qty]', pd);
      input.value = Math.max(1, Math.min(20, (Number(input.value) || 1) + Number(qtyBtn.dataset.qty)));
      return;
    }
    if (ev.target.closest('[data-checkout]')) {
      if (LIVE && bag.checkoutUrl) window.location.href = bag.checkoutUrl;
      else status('Preview store: once the Shopify store is connected, this button opens Shopify’s secure checkout with shipping and local pickup on the Square.');
    }
  });

  pd?.querySelector('[data-pd-form]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = selectedVariant();
    if (!v) return;
    const qty = Math.max(1, Math.min(20, Number($('[data-pd-qty]', pd).value) || 1));
    const btn = $('[data-pd-add]', pd);
    btn.disabled = true; btn.textContent = 'Adding…';
    await run(() => bagApi.add(v.id, qty));
    btn.disabled = false; btn.textContent = 'Add to bag';
    pd.close();
    status('');
    window.OOLALA.openDialog(drawer);
  });

  // --- start ----------------------------------------------------------------------------------------
  (async () => {
    try {
      catalog = await fetchCatalog();
      if (LIVE) renderGrids(); else buildFilters();
    } catch (err) {
      console.error(err);
      catalog = window.EDEN_CATALOG || [];
      buildFilters();
      const state = $('[data-shop-state]');
      if (state) { state.hidden = false; state.textContent = 'The online shop is taking a moment to load. Visit us on the Square, or call (512) 688-5707.'; }
    }
    await run(() => bagApi.load());
  })();
})();

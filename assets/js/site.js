// site.js — header, menu, dialogs, hero video, demo forms.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // --- dialogs (shared with shop.js) --------------------------------------------
  const syncScrollLock = () => document.body.classList.toggle('has-dialog', $$('dialog[open]').length > 0);
  window.OOLALA = {
    openDialog(d) {
      if (!d) return;
      if (!d.open) d.showModal();
      syncScrollLock();
    },
  };
  for (const d of $$('dialog')) {
    d.addEventListener('close', syncScrollLock);
    d.addEventListener('click', (ev) => {
      if (ev.target === d || ev.target.closest('[data-close]')) d.close();
    });
  }

  // --- header: see-through while it sits over a dark film or photo section -------------
  const header = $('[data-header]');
  if (header?.classList.contains('is-overlay')) {
    let queued = false;
    const update = () => {
      queued = false;
      const probe = header.offsetHeight - 1;
      const under = document.elementsFromPoint(window.innerWidth / 2, probe).find((el) => !header.contains(el));
      header.classList.toggle('is-solid', !under?.closest('[data-dark]'));
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
  }

  // --- mobile menu ----------------------------------------------------------------------
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    header.classList.toggle('menu-open', open);
  };
  toggle?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', (ev) => { if (ev.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && menu && !menu.hidden) setMenu(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (m) => { if (m.matches && menu) setMenu(false); });

  // --- films: play only what is on screen; one control pauses all motion ----------------
  const videos = $$('video[data-auto]');
  const toggles = $$('[data-motion-toggle]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduce.matches;
  const onScreen = new Set();
  const sync = () => {
    for (const v of videos) {
      const visible = onScreen.has(v) && v.getClientRects().length > 0;
      if (visible && !paused) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    }
    document.body.classList.toggle('motion-paused', paused);
    for (const t of toggles) {
      t.textContent = paused ? 'Play' : 'Pause';
      t.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} background video`);
    }
  };
  if (videos.length) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) en.isIntersecting ? onScreen.add(en.target) : onScreen.delete(en.target);
      sync();
    }, { threshold: 0.15 });
    videos.forEach((v) => io.observe(v));
    window.addEventListener('resize', sync);
  }
  for (const t of toggles) t.addEventListener('click', () => { paused = !paused; sync(); });
  sync();

  // --- demo forms (no endpoint yet) --------------------------------------------------------------
  for (const form of $$('[data-demo-form]')) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      const out = form.querySelector('.form-status') || form.nextElementSibling;
      if (out) out.textContent = form.dataset.success;
      form.reset();
    });
  }

  // visit.html?topic=studio preselects the studio inquiry
  const topic = new URLSearchParams(location.search).get('topic');
  const select = $('[data-topic]');
  if (topic && select) select.value = topic;
})();

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

  // --- header: solid once the hero is behind it ---------------------------------------
  const header = $('[data-header]');
  if (header?.classList.contains('is-overlay')) {
    const hero = $('.hero');
    const update = () => header.classList.toggle('is-solid', window.scrollY > Math.max(40, (hero?.offsetHeight || 400) - 90));
    update();
    window.addEventListener('scroll', update, { passive: true });
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

  // --- hero video --------------------------------------------------------------------------
  const video = $('.hero-video');
  const pause = $('[data-video-toggle]');
  if (video && pause) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const label = () => {
      pause.textContent = video.paused ? 'Play' : 'Pause';
      pause.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} background video`);
    };
    if (reduce.matches) video.pause();
    video.addEventListener('play', label);
    video.addEventListener('pause', label);
    pause.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); label(); });
    label();
  }

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

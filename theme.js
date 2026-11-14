/* Apply the saved appearance before styles load, on both map and gallery. */
(() => {
  'use strict';
  const storageKey = 'bagel-theme-v1';
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let preference = null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (valid(stored)) preference = stored;
  } catch { /* Theme switching still works when browser storage is disabled. */ }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? 'dark' : 'light');
    const dark = theme === 'dark';
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0c0f1d' : '#f5f6fb';
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? '切换为浅色模式' : '切换为深色模式';
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = dark ? '浅色模式' : '深色模式';
    }
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', applyTheme, { once: true });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('[data-theme-toggle]')) return;
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(storageKey, preference); } catch { /* Keep this tab usable. */ }
    applyTheme();
  });
  systemTheme.addEventListener('change', () => {
    if (!preference) applyTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : null;
    applyTheme();
  });
  // A page restored from the back/forward cache may have missed a storage event.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    try {
      const stored = localStorage.getItem(storageKey);
      preference = valid(stored) ? stored : null;
    } catch { /* Retain the in-memory preference. */ }
    applyTheme();
  });
})();

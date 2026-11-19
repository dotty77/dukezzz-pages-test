export function mountTuningWorkspace() {
  const byId = id => document.getElementById(id);
  const settings = document.createElement('details');
  settings.className = 'export-menu tuning-account-settings';
  const summary = document.createElement('summary');
  summary.dataset.i18nEn = 'Account tools';
  summary.textContent = '账号工具';
  const items = document.createElement('div');
  items.className = 'export-options';
  items.append(byId('export-json'), byId('export-uigf'), byId('export-csv'), byId('timezone-open'), byId('clear-account'));
  settings.append(summary, items);
  document.querySelector('.account-actions').replaceChildren(settings);
  const migration = byId('rng-import-open');
  if (migration) byId('import-guide').querySelector('.guide-content > div').append(migration);

  function reveal(id) {
    const el = byId(id);
    if (!el) return;
    for (let parent = el; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    requestAnimationFrame(() => el.scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }
  const aliases = {'personal-budget':'target-expectation', 'tuning-budget-view':'target-expectation', 'tuning-records-view':'tuning-signal-stats', 'dashboard':'tuning-signal-stats', 'pool-tabs':'tuning-signal-stats'};
  function resolveLink(id) {
    const resolved = aliases[id] || id;
    if (resolved === 'import-guide' || resolved === 'tuning-signal-stats' || byId(resolved)?.closest('.tuning-task-view')) return resolved;
    return null;
  }
  document.querySelector('.tuning-main').addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    const id = link && resolveLink(link.getAttribute('href').slice(1));
    if (id) { event.preventDefault(); reveal(id); }
  });
  function applyHash() {
    const id = resolveLink(location.hash.slice(1));
    if (id) reveal(id);
  }
  addEventListener('hashchange', applyHash);
  const api = {
    reveal,
    applyLocation() {
      if (!location.hash && new URL(location.href).searchParams.get('tool') === 'budget') reveal('target-expectation');
      else applyHash();
    },
    sync({account}) {
      byId('tuning-history-fold').hidden = !account;
      byId('tuning-extra-tools').hidden = !account;
    }
  };
  window.tuningWorkspace = api;
  return api;
}

export function mountTuningWorkspace() {
  const byId = id => document.getElementById(id);
  const views = {stats: byId('tuning-stats-view'), budget: byId('tuning-budget-view')};
  const tabs = byId('tuning-task-switch');
  const tools = byId('tuning-tools');
  let selected = 'stats';

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

  function select(key, {focus = false} = {}) {
    selected = key === 'budget' ? 'budget' : 'stats';
    for (const [name, view] of Object.entries(views)) {
      const on = selected === name, tab = byId('tuning-task-' + name);
      view.hidden = !on;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus({preventScroll: true});
    }
    if (selected === 'budget') views.budget.prepend(tools);
    else byId('tuning-signal-stats').querySelector('.record-namecard')?.after(tools);
  }

  function reveal(id) {
    const el = byId(id);
    if (!el) return;
    if (views.budget.contains(el)) select('budget');
    else if (views.stats.contains(el)) select('stats');
    for (let parent = el; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    requestAnimationFrame(() => el.scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }
  const aliases = {'tuning-records-view':'tuning-signal-stats', 'dashboard':'tuning-signal-stats', 'pool-tabs':'tuning-signal-stats'};
  function resolveLink(id) {
    const resolved = aliases[id] || id;
    if (resolved === 'import-guide' || resolved === 'tuning-signal-stats' || byId(resolved)?.closest('.tuning-task-view')) return resolved;
    return null;
  }
  document.querySelector('.tuning-main').addEventListener('click', event => {
    const tab = event.target.closest('[data-tuning-view]');
    if (tab) { select(tab.dataset.tuningView); return; }
    const link = event.target.closest('a[href^="#"]');
    const id = link && resolveLink(link.getAttribute('href').slice(1));
    if (id) { event.preventDefault(); reveal(id); }
  });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const key = event.key === 'Home' ? 'stats' : event.key === 'End' ? 'budget' : selected === 'stats' ? 'budget' : 'stats';
    select(key, {focus:true});
  });
  byId('demo-open').addEventListener('click', () => select('stats'));
  function applyHash() {
    const id = resolveLink(location.hash.slice(1));
    if (id) reveal(id);
  }
  addEventListener('hashchange', applyHash);
  const api = {
    select, reveal,
    getState: () => ({view:selected}),
    applyLocation() { select(new URL(location.href).searchParams.get('tool')); applyHash(); },
    sync({account}) {
      byId('tuning-history-fold').hidden = !account;
      byId('tuning-extra-tools').hidden = !account;
    }
  };
  window.tuningWorkspace = api;
  return api;
}

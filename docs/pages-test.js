/* The switch-site link carries no query strings, fragments or browser state. */
(() => {
  'use strict';
  const scope = '/dukezzz-pages-test/';
  if (!location.pathname.startsWith(scope)) return;
  const banner = document.createElement('aside');
  banner.className = 'pages-test-notice';
  banner.setAttribute('aria-label', 'GitHub Pages test site');
  const label = document.createElement('span');
  label.textContent = 'GitHub 试站';
  label.dataset.i18nEn = 'GitHub test site';
  const link = document.createElement('a');
  link.textContent = '返回正式站 ↗';
  link.dataset.i18nEn = 'Main site ↗';
  // Transfer no query strings, fragments, UIDs or browser state to the main site.
  const page = location.pathname.slice(scope.length);
  const allowed = new Set(['', 'index.html', 'agents.html', 'banners.html', 'disc-planner.html',
    'gallery.html', 'janus-3d.html', 'materials.html', 'oracle.html', 'showcase.html',
    'suburbs-3d.html', 'team.html', 'tuning.html', 'tv-wall.html']);
  link.href = 'https://dukezzz.com/' + (allowed.has(page) ? page : '');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  banner.append(label, link);
  document.body.append(banner);
})();

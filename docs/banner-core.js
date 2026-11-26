// Banner calendar time logic. Server times are 'YYYY-MM-DD HH:MM:SS' in each region's own UTC offset.
export function serverInstant(text, timezone) {
  const match = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(text || '');
  if (!match) return NaN;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h - timezone, mi, s);
}

export function phaseSpan(phase, region) {
  const span = phase.regions[region];
  if (!span) return null;
  // begin/end stay as server-time text for display; startAt/endAt are epoch milliseconds.
  return {...span, startAt: serverInstant(span.begin, span.timezone), endAt: serverInstant(span.end, span.timezone) + 999};
}

// Phases sorted newest first, each with its span for the chosen region; phases without that region are skipped.
export function timeline(calendar, region) {
  return calendar.phases.map(phase => ({phase, span: phaseSpan(phase, region)}))
    .filter(entry => entry.span && Number.isFinite(entry.span.startAt))
    .sort((a, b) => b.span.startAt - a.span.startAt);
}

export function currentState(calendar, region, now = Date.now()) {
  const list = timeline(calendar, region);
  const current = list.find(entry => entry.span.startAt <= now && now <= entry.span.endAt) || null;
  const upcoming = list.filter(entry => entry.span.startAt > now).at(-1) || null;
  const past = list.filter(entry => entry.span.endAt < now);
  return {current, upcoming, past, ended: !current && !upcoming && past.length > 0 ? past[0] : null};
}

export function remaining(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  return {days: Math.floor(total / 1440), hours: Math.floor(total % 1440 / 60), minutes: total % 60};
}

// 'MM-DD HH:MM' straight from the server-time string, so no browser time zone is applied.
export const serverLabel = text => /^\d{4}-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(text || '')?.slice(1).join(' ').replace(/^(\d\d) (\d\d)/, '$1-$2') || '';

export const REGION_STORAGE = 'duke-banner-region-v1';
export function preferredRegion(regions) {
  try {
    const saved = localStorage.getItem(REGION_STORAGE);
    if (regions.some(r => r.id === saved)) return saved;
  } catch { /* Private browsing can disable storage. */ }
  return -new Date().getTimezoneOffset() / 60 <= -3 ? 'prod_gf_us' : 'prod_gf_cn';
}

// The two planners share a server preference. Schedule from server instants so
// a tab left open across reset shows the same event state as a fresh visit.
export function mountServerEvent(box, calendar, regionId, event) {
  if (!event) return () => {};
  let timer;
  function render() {
    clearTimeout(timer);
    const region = calendar.regions.find(r => r.id === regionId());
    const start = serverInstant(event.begin, region?.timezone);
    const end = serverInstant(event.end, region?.timezone) + 1000;
    const now = Date.now();
    box.hidden = !(now >= start && now < end);
    if (now < end) timer = setTimeout(render, Math.min((now < start ? start : end) - now, 2147483647));
    if (box.hidden) return;
    const en = window.DUKE_I18N?.language === 'en';
    const title = document.createElement('h2');
    const details = document.createElement('p');
    const group = document.createElement('div');
    const link = document.createElement('a');
    title.textContent = en ? event.titleEn : event.title;
    const deadline = serverLabel(event.end);
    details.textContent = en
      ? `${event.textEn} Ends ${deadline} (${region.labelEn} server time).`
      : `${event.text}${region.label} ${deadline} 截止。`;
    link.href = en ? event.urlEn : event.url;
    link.textContent = en ? 'Event details ↗' : '活动公告 ↗';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    group.append(title, details);
    box.replaceChildren(group, link);
  }
  window.addEventListener('dukelanguagechange', render);
  window.addEventListener('storage', e => { if (e.key === REGION_STORAGE || e.key === null) render(); });
  window.addEventListener('pageshow', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  return render;
}

export function mountTrainingEvent(box, calendar, regionId) {
  return mountServerEvent(box, calendar, regionId, calendar.trainingEvent);
}

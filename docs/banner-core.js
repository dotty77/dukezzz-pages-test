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

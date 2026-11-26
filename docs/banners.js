import {$, el, picture, loadJSON} from './agent-picker.js?v=20261107-refresh-launch-1';
import {currentState, timeline, remaining, serverLabel, serverInstant, REGION_STORAGE, preferredRegion, mountTrainingEvent} from './banner-core.js?v=20261126-creator-events-launch-1';

let calendar, catalog, region;
const phaseName = phase => `${phase.version} ${phase.half}`;
const tzLabel = tz => `UTC${tz >= 0 ? '+' : ''}${tz}`;
const item = id => catalog[id] || {name: id};
const line = (label, value, strong = false) => { const p = el('p'); p.append(el('span', '', label), el(strong ? 'strong' : 'span', '', value)); return p; };

function tags(banner) {
  const wrap = el('div', 'banner-tags');
  wrap.append(el('span', 'pill accent', banner.kind === 'agent' ? '代理人' : '音擎'));
  if (banner.special) wrap.append(el('span', 'pill warn', '独家重映'));
  else if (banner.rerun) wrap.append(el('span', 'pill off', '复刻'));
  return wrap;
}

function bannerCard(banner) {
  const card = el('article', 'banner-card'); card.dataset.kind = banner.kind;
  const main = item(banner.featuredS[0]), copy = el('div');
  const title = el('p', '', `「${banner.title}」`); if (banner.titleEn) title.dataset.i18nEn = `“${banner.titleEn}”`;
  copy.append(el('h3', '', banner.featuredS.map(id => item(id).name).join(' / ')), title, tags(banner));
  if (banner.featuredA.length) {
    // Since 3.1 these are only the default A-Rank rate-ups; each player can pick their own pair in game.
    const ups = el('div', 'banner-a'), label = el('span', 'banner-a-label', '默认 A 级UP');
    label.title = '可在游戏内「A概率提升」自选替换'; ups.append(label);
    for (const id of banner.featuredA) { const span = el('span'); span.append(picture(item(id).icon, ''), el('span', '', item(id).name)); ups.append(span); }
    copy.append(ups);
  }
  card.append(picture(main.icon, '', 'planner-icon'), copy);
  return card;
}

function localEnd(span) {
  const offset = -new Date().getTimezoneOffset() / 60;
  if (offset === span.timezone) return null;
  const format = new Intl.DateTimeFormat(window.DUKE_I18N?.language === 'en' ? 'en-US' : 'zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false});
  return format.format(new Date(span.endAt));
}

function renderCurrent() {
  const state = currentState(calendar, region), box = $('banner-current');
  box.hidden = state.ended && !$('banner-next').hidden;
  if (box.hidden) { box.replaceChildren(); return state; }
  if (state.ended && calendar.upcoming) {
    box.replaceChildren(el('p', 'planner-muted', english() ? 'No active channel has been confirmed.' : '暂无已确认的当前频段。'));
    return state;
  }
  const entry = state.current || state.ended || state.upcoming;
  if (!entry) { box.replaceChildren(el('p', 'planner-empty', '这个服务器暂无已收录的频段。')); return state; }
  const {phase, span} = entry, head = el('div', 'banner-current-head'), left = el('div'), right = el('div', 'banner-times');
  const title = el('h2'); title.append(el('span', 'pill accent', phaseName(phase)), el('span', '', state.current ? '当前频段' : state.ended ? '本期已结束' : '即将开启'));
  left.append(title);
  if (state.current || state.upcoming && !state.ended) {
    const time = remaining((state.current ? span.endAt : span.startAt) - Date.now());
    const countdown = el('p', 'banner-countdown'); countdown.setAttribute('role', 'timer');
    countdown.append(el('b', '', String(time.days)), el('span', '', '天'), el('b', '', String(time.hours).padStart(2, '0')), el('span', '', '小时'), el('b', '', String(time.minutes).padStart(2, '0')), el('span', '', '分'));
    left.append(countdown, el('p', 'planner-muted', state.current ? '距离本期结束' : '距离开启'));
  } else left.append(el('p', 'planner-muted', '新频段资料待更新，请以游戏内公告为准。'));
  right.append(line('开始 ', serverLabel(span.begin), true), line('结束 ', serverLabel(span.end), true), line('服务器时间 ', tzLabel(span.timezone)));
  const local = localEnd(span);
  if (local) right.append(line('本地时间结束于 ', local));
  head.append(left, right);
  const grid = el('div', 'banner-grid');
  grid.append(...phase.banners.map(bannerCard));
  box.replaceChildren(head, grid);
  return state;
}

function shortDate(text, showYear = false) {
  const [, year, month, day, time] = /^(\d{4})-(\d\d)-(\d\d)(?: (\d\d:\d\d))?/.exec(text);
  const date = new Date(Date.UTC(year, month - 1, day));
  const label = new Intl.DateTimeFormat(english() ? 'en-US' : 'zh-CN', {
    month: english() ? 'short' : 'long', day: 'numeric', year: showYear ? 'numeric' : undefined, timeZone: 'UTC'
  }).format(date);
  return time ? `${label} ${time}` : label;
}

function nextEntry(entry, kind) {
  const info = entry.id && catalog[entry.id] ? catalog[entry.id] : {};
  const span = el('span', 'history-item'); span.dataset.kind = kind;
  const name = el(entry.profile ? 'a' : 'span', '', english() && entry.nameEn ? entry.nameEn : entry.name || info.name || entry.id);
  if (entry.profile) name.href = `agents.html#agent=${encodeURIComponent(entry.profile)}`;
  const icon = entry.icon || info.icon;
  if (icon) span.append(picture(icon, ''));
  span.append(name);
  if (entry.rerun) span.append(el('span', 'pill off', '复刻'));
  if (entry.title) span.title = english() && entry.titleEn ? `“${entry.titleEn}”` : `「${entry.title}」`;
  return span;
}
const english = () => window.DUKE_I18N?.language === 'en';
function renderProgram() {
  const panel = $('banner-program');
  if (!panel) return;
  const program = calendar.specialProgram;
  const start = new Date(program?.startsAt);
  panel.hidden = !(Number.isFinite(start.getTime()) && Date.now() < Date.parse(program.showUntil));
  if (panel.hidden) return;

  const en = english(), locale = en ? 'en-US' : 'zh-CN';
  const options = {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'};
  const beijingTime = new Intl.DateTimeFormat(locale, {...options, timeZone: 'Asia/Shanghai'}).format(start);
  let label = en ? `${beijingTime} (UTC+8)` : `北京时间 ${beijingTime}（UTC+8）`;
  if (start.getTimezoneOffset() !== -480) {
    const localTime = new Intl.DateTimeFormat(locale, options).format(start);
    label += en ? ` · Your time ${localTime}` : ` · 你的时间 ${localTime}`;
  }
  $('banner-program-title').textContent = en ? program.titleEn : program.title;
  const time = $('banner-program-time');
  time.dateTime = program.startsAt;
  time.textContent = label;
  const link = $('banner-program-source');
  link.href = en ? program.urlEn : program.url;
  link.textContent = en ? 'Official announcement ↗' : '官方预告 ↗';
}

function sourceLink(source, globalSource = english()) {
  const link = el('a', '', `${english() && source.titleEn ? source.titleEn : source.title} ↗`);
  link.href = globalSource && source.urlEn ? source.urlEn : source.url;
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}

// Special-program codes differ between 国服 and the global servers; hidden once they expire.
function codeLine(codes) {
  const code = codes?.byRegion?.[region];
  if (!code || !(Date.now() < serverInstant(codes.expires, codes.timezone) + 1000)) return null;
  const line = el('p', 'next-code'), text = el('code', '', code), button = el('button', 'ghost-button', '复制');
  button.type = 'button';
  button.addEventListener('click', async () => {
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch {
      // Clipboard API can be blocked (permissions policy); select the code and fall back to the copy command.
      const range = document.createRange(); range.selectNodeContents(text);
      getSelection().removeAllRanges(); getSelection().addRange(range);
      try { copied = document.execCommand('copy'); } catch { /* the code stays selected for manual copying */ }
    }
    button.textContent = copied ? '已复制' : '复制失败';
    setTimeout(() => { button.textContent = '复制'; }, 1500);
  });
  const expiry = `${shortDate(codes.expires)}:${codes.expires.slice(-2)} (${tzLabel(codes.timezone)})`;
  const label = english() ? 'Livestream code' : '前瞻兑换码';
  const amount = codes.polychromes ? ` · ${codes.polychromes} ${english() ? 'Polychromes' : '菲林'}` : '';
  line.append(el('span', '', label + amount), text, button, el('small', '', english() ? `Valid through ${expiry}` : `有效至 ${expiry}`));
  return line;
}

function renderNext() {
  const box = $('banner-next'), upcoming = calendar.upcoming;
  box.hidden = true;
  if (!upcoming) return;
  const en = english(), timezone = calendar.regions.find(server => server.id === region).timezone;
  const now = Date.now(), serverDay = new Date(now + timezone * 3600000).toISOString().slice(0, 10);
  const listed = timeline(calendar, region).filter(({phase}) => phase.version === upcoming.version);
  const officialItems = new Set(listed.flatMap(({phase}) => phase.banners.flatMap(banner => banner.featuredS)));
  const prevRewardsOpen = box.querySelector('details')?.open || false;
  const copy = el('div');
  const heading = el('h2', '', en ? `Version ${upcoming.version}` : `${upcoming.version} 版本`);
  heading.id = 'banner-next-title';
  const eyebrow = el('p', 'tuning-eyebrow', en ? 'Announced channels' : '已公布排期');
  copy.append(eyebrow, heading);
  if (upcoming.name) { const name = el('p', '', `「${upcoming.name}」`); if (upcoming.nameEn) name.dataset.i18nEn = `“${upcoming.nameEn}”`; copy.append(name); }
  // Distinct channels can open together and close on different days. Remove
  // only entries present in this server's live feed, or past their own end.
  const phases = upcoming.phases.filter(phase => {
    const end = phase.end.length === 16 ? phase.end + ':59' : phase.end;
    return now < serverInstant(end, timezone) + 1000;
  });
  if (!phases.length) return;
  if (upcoming.release) {
    const date = shortDate(upcoming.release);
    copy.append(el('p', 'planner-muted', en ? `${upcoming.confirmed ? 'Update' : 'Expected update'} · ${date}` : `${upcoming.confirmed ? '' : '预计 '}${date}更新`));
  } else {
    copy.append(el('p', 'planner-muted', phases[0].afterUpdate ? `${shortDate(phases[0].afterUpdate)}更新后开启` : `${shortDate(phases[0].start)} 开启`));
  }
  const code = codeLine(upcoming.codes);
  if (code) copy.append(code);
  const side = el('div', 'next-phases');
  for (const phase of phases) {
    const agents = phase.agents.filter(entry => !officialItems.has(entry.id));
    const engines = phase.engines.filter(entry => !officialItems.has(entry.id));
    if (!agents.length && !engines.length) continue;
    const row = el('div', 'history-row'), head = el('div'), list = el('div', 'history-items');
    const start = phase.afterUpdate ? (en ? `After the ${shortDate(phase.afterUpdate)} update` : `${shortDate(phase.afterUpdate)}更新后`) : shortDate(phase.start);
    const title = el('h3', '', (en ? phase.labelEn : phase.label) || `${upcoming.version} ${phase.half}`);
    const startTime = phase.start?.length === 16 ? phase.start + ':00' : phase.start;
    const active = phase.afterUpdate ? serverDay > phase.afterUpdate : now >= serverInstant(startTime, timezone);
    const updateDay = phase.afterUpdate === serverDay;
    const status = active ? (en ? 'Active' : '进行中') : updateDay ? (en ? 'After maintenance' : '更新后开启') : (en ? 'Upcoming' : '待开启');
    title.append(' ', el('span', active ? 'pill accent' : 'pill off', status));
    const spansYears = (phase.afterUpdate || phase.start).slice(0, 4) !== phase.end.slice(0, 4);
    head.append(title, el('p', '', `${start} – ${shortDate(phase.end, spansYears)}`));
    for (const [kind, label, entries] of [['agent', en ? 'Agents' : '代理人', agents], ['engine', en ? 'W-Engines' : '音擎', engines]]) {
      if (!entries.length) continue;
      const group = el('div', 'history-items');
      group.append(el('small', 'history-item planner-muted', label), ...entries.map(entry => nextEntry(entry, kind)));
      list.append(group);
    }
    row.append(head, list);
    side.append(row);
  }
  if (!side.children.length) {
    if (!upcoming.rewards?.length && !code) return;
    eyebrow.textContent = en ? 'Version rewards' : '版本福利';
  }
  if (upcoming.rewards?.length) {
    const details = el('details');
    details.open = prevRewardsOpen;
    details.append(el('summary', '', en ? 'Free Robin and event rewards' : '免费知更鸟与版本福利'));
    for (const reward of upcoming.rewards) {
      if (reward.from && now < Date.parse(reward.from)) continue;
      if (reward.until && now >= Date.parse(reward.until)) continue;
      const text = el('p', 'planner-muted', en ? reward.textEn : reward.text);
      if (reward.source) text.append(' ', sourceLink(reward.source, region !== 'prod_gf_cn'));
      details.append(text);
    }
    side.append(details);
  }
  const note = el('p', 'planner-muted');
  note.append(el('span', '', en ? `Channel times · server time (${tzLabel(timezone)})` : `卡池时间按所选服务器（${tzLabel(timezone)}）显示。`));
  for (const source of upcoming.sources || (upcoming.source ? [upcoming.source] : [])) note.append(' ', sourceLink(source));
  const link = el('a', '', '在调频分析里规划抽卡 →'); link.href = 'tuning.html?v=20261118-reviewed-ui-launch-1';
  side.append(note, link);
  box.replaceChildren(copy, side);
  box.hidden = false;
}

function renderHistory(state) {
  const rows = timeline(calendar, region).filter(entry => entry.phase !== state.current?.phase);
  $('banner-history').replaceChildren(...(rows.length ? rows.map(({phase, span}) => {
    const row = el('div', 'history-row'), head = el('div'), list = el('div', 'history-items');
    head.append(el('h3', '', phaseName(phase)), el('p', '', `${serverLabel(span.begin)} – ${serverLabel(span.end)}`));
    for (const banner of phase.banners) {
      for (const id of banner.featuredS) {
        const entry = el('span', 'history-item'); entry.dataset.kind = banner.kind;
        entry.append(picture(item(id).icon, ''), el('span', '', item(id).name));
        if (banner.special) entry.append(el('span', 'pill warn', '独家重映'));
        else if (banner.rerun) entry.append(el('span', 'pill off', '复刻'));
        list.append(entry);
      }
    }
    row.append(head, list);
    return row;
  }) : [el('p', 'planner-empty', '暂无往期记录')]));
}

function render() {
  renderProgram();
  renderNext();
  renderHistory(renderCurrent());
}

async function main() {
  try {
    const [data, tuning] = await Promise.all([loadJSON('banner-calendar.json?v=20261126-creator-events-launch-1'), loadJSON('tuning-catalog.json?v=20261118-reviewed-ui-launch-1')]);
    calendar = data; catalog = tuning.items;
    region = preferredRegion(calendar.regions);
    const select = $('banner-region');
    select.replaceChildren(...calendar.regions.map(r => { const option = el('option', '', r.label); option.value = r.id; return option; }));
    select.value = region;
    const updateTrainingEvent = mountTrainingEvent($('training-event'), calendar, () => region);
    select.addEventListener('change', () => { region = select.value; try { localStorage.setItem(REGION_STORAGE, region); } catch { /* not saved */ } updateTrainingEvent(); render(); });
    render();
    setInterval(() => { if (!document.hidden) render(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  } catch (error) {
    $('banner-status').textContent = '资料读取失败，请刷新重试。';
    console.error(error);
  }
}
window.addEventListener('dukelanguagechange', () => { if (calendar) render(); });
main();

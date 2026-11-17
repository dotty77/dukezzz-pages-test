import {$, el, picture, loadJSON} from './agent-picker.js?v=20261107-refresh-launch-1';
import {currentState, timeline, remaining, serverLabel} from './banner-core.js?v=20261001-planner-1';

const STORE_REGION = 'duke-banner-region-v1';
let calendar, catalog, region;
const phaseName = phase => `${phase.version} ${phase.half}`;
const tzLabel = tz => `UTC${tz >= 0 ? '+' : ''}${tz}`;
const item = id => catalog[id] || {name: id};
const line = (label, value, strong = false) => { const p = el('p'); p.append(el('span', '', label), el(strong ? 'strong' : 'span', '', value)); return p; };

function defaultRegion() {
  try { const saved = localStorage.getItem(STORE_REGION); if (calendar.regions.some(r => r.id === saved)) return saved; } catch { /* use the guess */ }
  return -new Date().getTimezoneOffset() / 60 <= -3 ? 'prod_gf_us' : 'prod_gf_cn';
}

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

// '2026-11-11 12:00' → '11月11日 12:00'; a date alone → '10月21日'.
const shortDate = text => { const [, m, d, time] = /^\d{4}-(\d\d)-(\d\d)(?: (\d\d:\d\d))?/.exec(text); return `${Number(m)}月${Number(d)}日${time ? ` ${time}` : ''}`; };

function nextEntry(entry, kind) {
  const info = entry.id && catalog[entry.id] ? catalog[entry.id] : {};
  const span = el('span', 'history-item'); span.dataset.kind = kind;
  const name = el('span', '', entry.name || info.name || entry.id);
  if (entry.nameEn) name.dataset.i18nEn = entry.nameEn;
  span.append(picture(entry.icon || info.icon, ''), name);
  if (entry.rerun) span.append(el('span', 'pill off', '复刻'));
  if (entry.title) span.title = english() && entry.titleEn ? `“${entry.titleEn}”` : `「${entry.title}」`;
  return span;
}
const english = () => window.DUKE_I18N?.language === 'en';
function sourceLink(source) {
  const link = el('a', '', `${source.title} ↗`);
  link.href = english() && source.urlEn ? source.urlEn : source.url;
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}

// Special-program codes differ between 国服 and the global servers; hidden once they expire.
function codeLine(codes) {
  const code = codes?.byRegion?.[region];
  const [, y, m, d, hh, mm, ss] = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(codes?.expires || '') || [];
  if (!code || !y || Date.now() > Date.UTC(y, m - 1, d, hh - codes.timezone, mm, ss)) return null;
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
  line.append(el('span', '', '前瞻兑换码'), text, button, el('small', '', `${Number(m)}月${Number(d)}日 ${hh}:${mm}（UTC+${codes.timezone}）前有效`));
  return line;
}

function renderNext(state) {
  const box = $('banner-next'), upcoming = calendar.upcoming;
  const latest = timeline(calendar, region)[0];
  const show = upcoming && latest && (state.current?.phase === latest.phase || state.ended?.phase === latest.phase);
  box.hidden = !show;
  if (!show) return;
  const copy = el('div');
  copy.append(el('p', 'tuning-eyebrow', '下一期'), el('h2', '', `${upcoming.version} 版本`));
  if (upcoming.name) { const name = el('p', '', `「${upcoming.name}」`); if (upcoming.nameEn) name.dataset.i18nEn = `“${upcoming.nameEn}”`; copy.append(name); }
  // Once this server's official gacha list has a phase, it is shown above and dropped from here.
  const listed = new Set(timeline(calendar, region).map(entry => entry.phase.id));
  const phases = upcoming.phases.filter(phase => !listed.has(`${upcoming.version}-${phase.half === '上半' ? 1 : 2}`));
  if (!phases.length) { box.hidden = true; return; }
  if (upcoming.release) {
    const [, month, day] = upcoming.release.split('-').map(Number);
    copy.append(el('p', 'planner-muted', `${upcoming.confirmed ? '' : '预计 '}${month} 月 ${day} 日更新`));
  } else {
    copy.append(el('p', 'planner-muted', phases[0].afterUpdate ? `${shortDate(phases[0].afterUpdate)}更新后开启` : `${shortDate(phases[0].start)} 开启`));
  }
  const code = codeLine(upcoming.codes);
  if (code) copy.append(code);
  const side = el('div', 'next-phases');
  for (const phase of phases) {
    const row = el('div', 'history-row'), head = el('div'), list = el('div', 'history-items');
    const start = phase.afterUpdate ? `${shortDate(phase.afterUpdate)}更新后` : shortDate(phase.start);
    const title = el('h3', '', `${upcoming.version} ${phase.half}`);
    if (phase.status) title.append(' ', el('span', phase.status === 'notice' ? 'pill accent' : 'pill off', phase.status === 'notice' ? '调频已公告' : '前瞻预告'));
    head.append(title, el('p', '', `${start} – ${shortDate(phase.end)}`));
    list.append(...phase.agents.map(entry => nextEntry(entry, 'agent')), ...phase.engines.map(entry => nextEntry(entry, 'engine')));
    row.append(head, list);
    side.append(row);
  }
  if (!side.children.length) { box.hidden = true; return; }
  const note = el('p', 'planner-muted');
  note.append(el('span', '', '前瞻为开发中内容，以游戏内调频公告为准。'));
  for (const source of upcoming.sources || (upcoming.source ? [upcoming.source] : [])) note.append(' ', sourceLink(source));
  const link = el('a', '', '在调频分析里规划抽卡 →'); link.href = 'tuning.html?v=20261117-team-lazy-beta-launch-1';
  side.append(note, link);
  box.replaceChildren(copy, side);
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
  const state = renderCurrent();
  renderNext(state); renderHistory(state);
}

async function main() {
  try {
    const [data, tuning] = await Promise.all([loadJSON('banner-calendar.json?v=20261111-refresh-launch-1'), loadJSON('tuning-catalog.json?v=20261111-refresh-launch-1')]);
    calendar = data; catalog = tuning.items;
    region = defaultRegion();
    const select = $('banner-region');
    select.replaceChildren(...calendar.regions.map(r => { const option = el('option', '', r.label); option.value = r.id; return option; }));
    select.value = region;
    select.addEventListener('change', () => { region = select.value; try { localStorage.setItem(STORE_REGION, region); } catch { /* not saved */ } render(); });
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

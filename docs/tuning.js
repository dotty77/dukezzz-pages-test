// reviewed:tuning.js
import { POOL_META as POOL_META2, IMPORT_LIMITS, parseImport, mergeAccounts, analyzeAccount as analyzeAccount2, exportBackup, exportUIGF, exportCSV } from "./tuning-core.js?v=20260914-duke-brand-1";
import { openStorage, readImportState, updateAccounts, persistent } from "./tuning-storage.js?v=20261118-tuning-records-launch-1";
import { rateLuck } from "./tuning-rating.js?v=20260914-duke-brand-1";
import { setupLinkImport } from "./tuning-link.js?v=20261118-reviewed-ui-launch-1";
import { renderGuarantee, loadBannerData } from "./tuning-summary.js?v=20261118-tuning-records-launch-1";
import { mountExpectation, mountUpPairs, renderUpPairs } from "./tuning-targets.js?v=20261124-ui-interactions-launch-1";
import { cloneData } from "./tuning-compat.js?v=20260909-tuning-win11-1";
import { fetchTuningJSON } from "./tuning-resources.js?v=20260909-tuning-win11-1";
import { isRngBackup } from "./tuning-rng.js?v=20260911-community-update-1";
import { mountRngMigration, reviewRngMigration } from "./tuning-rng-ui.js?v=20260914-duke-brand-1";
import { mountTuningWorkspace } from "./tuning-simple.js?v=20261118-reviewed-ui-launch-1";

// reviewed:tuning-records-core.js
import { analyzeAccount, POOL_META } from "./tuning-core.js?v=20260914-duke-brand-1";
import { serverInstant, timeline } from "./banner-core.js?v=20261126-creator-events-launch-1";
import { guaranteeState, signalOutcomes } from "./tuning-summary.js?v=20261118-tuning-records-launch-1";
var channelOrder = ["2", "3", "102", "103", "1", "5"];
var specialLabels = { "102": "独家重映", "103": "音擎回响" };
var limitedChannels = /* @__PURE__ */ new Set(["2", "3", "102", "103"]);
var zeroCounts = () => ({ S: 0, A: 0, B: 0, unknown: 0 });
function recordWallet(wallet, channelId) {
  const id = String(channelId), canConvert = limitedChannels.has(id);
  const ticketKind = canConvert ? "encryptedTapes" : id === "1" ? "masterTapes" : id === "5" ? "boopons" : null;
  const amounts = [wallet?.encryptedTapes, wallet?.polychrome, wallet?.monochrome].map((value) => Number.isSafeInteger(value) && value >= 0 ? value : null);
  const known = amounts.filter((value) => value !== null).length;
  let equivalentPulls = null;
  if (canConvert && known > 0) {
    const [tapes, polychrome, monochrome] = amounts;
    const currency = (polychrome ?? 0) + (monochrome ?? 0), pulls = (tapes ?? 0) + Math.floor(currency / 160);
    if (Number.isSafeInteger(currency) && Number.isSafeInteger(pulls)) equivalentPulls = pulls;
  }
  return { ticketKind, canConvert, equivalentPulls, partial: equivalentPulls !== null && known < amounts.length };
}
function calendarContext(calendar2, region, versionStarts2, now) {
  const phases = calendar2?.phases || [];
  const knownRegions = (calendar2?.regions || []).map((r) => r.id);
  const calendarRows = new Map(knownRegions.map((id) => [id, timeline({ phases }, id)]));
  const timelines = (region ? [calendarRows.get(region) ?? timeline({ phases }, region)] : [...calendarRows.values()]).filter((rows) => rows.length);
  function commonPhase(find) {
    const selected = timelines.map((rows) => find(rows)?.phase);
    return selected[0] && selected.every((p) => p?.id === selected[0].id) ? selected[0] : null;
  }
  const activeAt = (rows, at) => rows.find(({ span }) => at >= span.startAt && at <= span.endAt);
  const phaseAt = (at) => Number.isFinite(at) ? commonPhase((rows) => activeAt(rows, at)) : null;
  const activeByRegion = timelines.map((rows) => activeAt(rows, now)?.phase);
  const current = phaseAt(now);
  const upcoming = commonPhase((rows) => rows.filter(({ span }) => span.startAt > now).at(-1));
  const horizons = timelines.length ? timelines : [...calendarRows.values()].filter((rows) => rows.length);
  const latestEnd = horizons.length ? Math.min(...horizons.map((rows) => rows[0].span.endAt)) : -Infinity;
  const starts = [...versionStarts2].sort((a, b) => b.startAt - a.startAt);
  function versionAt(at) {
    if (!Number.isFinite(at)) return null;
    const index = starts.findIndex((v) => at >= v.startAt);
    if (index > 0 || index === 0 && at <= latestEnd) return starts[index].version;
    return phaseAt(at)?.version || null;
  }
  const currentVersion = versionAt(now);
  const datedStart = starts.find((v) => v.version === currentVersion)?.startAt;
  const phaseStarts = timelines.flatMap((rows) => rows.filter(({ phase }) => phase.version === currentVersion).map(({ span }) => span.startAt));
  const currentStart = datedStart ?? Math.min(...phaseStarts);
  const currentPhases = [];
  for (const { phase } of timelines[0] || []) {
    if (phase.version !== currentVersion) continue;
    const spans = timelines.map((rows) => rows.find((row) => row.phase.id === phase.id)?.span);
    if (spans.some((span) => !span)) continue;
    const states = spans.map((span) => now < span.startAt ? "future" : now > span.endAt ? "past" : "active");
    const status = states.every((state) => state === states[0]) ? states[0] : "uncertain";
    if (status === "future") continue;
    const sameEnd = (key) => spans.every((span) => span[key] === spans[0][key]) ? spans[0][key] : null;
    currentPhases.push({ phase, status, endAt: sameEnd("endAt"), endLocal: sameEnd("end") });
  }
  function openFor(id) {
    if (!activeByRegion.length || !currentVersion) return null;
    const states = activeByRegion.map((phase) => phase ? featured(phase, id).length > 0 : false);
    return states.every((state) => state === states[0]) ? states[0] : null;
  }
  return { current, upcoming, versionAt, phaseAt, currentVersion, currentStart, currentPhases, openFor };
}
function featured(phase, pool) {
  const ids = (phase?.banners || []).filter((b) => String(b.pool) === pool).flatMap((b) => b.featuredS || []);
  return [...new Set(ids.map(String))];
}
function upTotals(history2) {
  let knownUpCount = 0, unknownUpCount = 0, upCycleCount = 0, pulls = 0, sinceUp = null;
  for (const hit of history2) {
    if (hit.interval === null || hit.outcome === "unknown") sinceUp = null;
    else if (sinceUp !== null) sinceUp += hit.interval;
    if (hit.outcome === "unknown") unknownUpCount++;
    if (hit.outcome !== "up") continue;
    knownUpCount++;
    if (sinceUp !== null) {
      pulls += sinceUp;
      upCycleCount++;
    }
    sinceUp = 0;
  }
  return {
    knownUpCount,
    unknownUpCount,
    upCount: unknownUpCount ? null : knownUpCount,
    upCycleCount,
    averageUpPulls: upCycleCount ? pulls / upCycleCount : null
  };
}
function buildRecordOverview(account, { stats: stats2, catalog: catalog2 = {}, banners: banners2, calendar: calendar2, region, versionStarts: versionStarts2 = [], now = Date.now() } = {}) {
  const records = account?.records || [];
  const analysis = account && (stats2?.uid === account.uid ? stats2 : analyzeAccount(account));
  const pools = new Map((analysis?.pools || []).map((pool) => [pool.id, pool]));
  const schedule = calendarContext(calendar2, region, versionStarts2, now);
  const forRegion = (windows) => (windows || []).filter((window2) => window2.regions?.includes(region));
  const rules = region && banners2 ? { ...banners2, windows: forRegion(banners2.windows), specialWindows: forRegion(banners2.specialWindows) } : banners2;
  const byId = /* @__PURE__ */ new Map(), currentCounts = /* @__PURE__ */ new Map(), uncertain = /* @__PURE__ */ new Set();
  const participation = /* @__PURE__ */ new Map();
  let firstTime = null, lastTime = null;
  for (const record of records) {
    const at = Number.isInteger(account.timezone) ? serverInstant(record.time, account.timezone) : NaN;
    const version = schedule.versionAt(at);
    const phase = schedule.phaseAt(at);
    const phaseId = phase && (!limitedChannels.has(record.pool) || (phase.banners || []).some((b) => String(b.pool) === record.pool)) ? phase.id : null;
    if (!participation.has(record.pool)) participation.set(record.pool, { dates: /* @__PURE__ */ new Map(), unassigned: 0 });
    const channelPhases = participation.get(record.pool);
    if (phaseId) channelPhases.dates.set(phaseId, Math.max(at, channelPhases.dates.get(phaseId) ?? -Infinity));
    else channelPhases.unassigned++;
    if (record.rank === "S") byId.set(record.id, { record, version, phaseId });
    if (version && version === schedule.currentVersion) {
      if (!currentCounts.has(record.pool)) currentCounts.set(record.pool, zeroCounts());
      currentCounts.get(record.pool)[record.rank || "unknown"]++;
    } else if (!version && (!Number.isFinite(at) || at >= schedule.currentStart)) uncertain.add(record.pool);
    if (!firstTime || record.time < firstTime) firstTime = record.time;
    if (!lastTime || record.time > lastTime) lastTime = record.time;
  }
  const channels2 = [.../* @__PURE__ */ new Set([...channelOrder, ...pools.keys()])].map((id) => {
    const pool = pools.get(id);
    const consistent = pool?.recordOrderConsistent && pool.hardPityConsistent;
    const history2 = pool?.sHistory || [];
    const split = limitedChannels.has(id);
    const outcomes = split && history2.length ? signalOutcomes(account, id, catalog2, rules) : /* @__PURE__ */ new Map();
    const hits = history2.map((hit) => ({
      ...byId.get(hit.id),
      interval: consistent ? hit.interval : null,
      outcome: outcomes.get(hit.id) || "unknown"
    }));
    const up = split ? upTotals(hits) : { upCount: null, knownUpCount: 0, unknownUpCount: 0, upCycleCount: 0, averageUpPulls: null };
    const sHistory = hits.reverse(), currentHistory = [], pastHistory = [], groups = /* @__PURE__ */ new Map();
    for (const hit of sHistory) {
      if (split && schedule.currentVersion && hit.version === schedule.currentVersion) currentHistory.push(hit);
      else {
        pastHistory.push(hit);
        if (!groups.has(hit.version)) groups.set(hit.version, []);
        groups.get(hit.version).push(hit);
      }
    }
    const currentPity = consistent ? pool.currentPity : null, hardPity = POOL_META[id]?.hardPity ?? null;
    const remainingIsUp = currentPity !== null && ["2", "3"].includes(id) && sHistory[0]?.outcome === "off" && guaranteeState(account, pool, catalog2, rules).state === "big";
    const rankCounts = pool?.rankCounts || zeroCounts();
    const currentRankCounts = !split ? rankCounts : schedule.currentVersion && !uncertain.has(id) ? currentCounts.get(id) || zeroCounts() : null;
    const currentCount = currentRankCounts ? Object.values(currentRankCounts).reduce((sum, n) => sum + n, 0) : null;
    const currentPhases = schedule.currentPhases.map(({ phase, ...timing }) => ({
      id: phase.id,
      version: phase.version,
      half: phase.half,
      ...timing,
      featured: featured(phase, id),
      records: currentHistory.filter((hit) => hit.phaseId === phase.id)
    })).filter((phase) => phase.featured.length);
    const channelPhases = participation.get(id);
    const recentPhaseIds = Array.from(channelPhases?.dates || []).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([phase]) => phase);
    const previewPools = ["2", "102"].includes(id) ? ["2", "102"] : ["3", "103"].includes(id) ? ["3", "103"] : [];
    const upcomingFeatured = [...new Set(previewPools.flatMap((pool2) => featured(schedule.upcoming, pool2)))];
    if (split && rankCounts.unknown) up.upCount = null;
    return {
      id,
      label: Object.hasOwn(specialLabels, id) ? specialLabels[id] : POOL_META[id]?.label || pool?.label,
      count: pool?.count || 0,
      split,
      ...up,
      rankCounts,
      currentRankCounts,
      currentCount,
      currentPity,
      hardPity,
      remainingIsUp,
      remainingPity: currentPity !== null && hardPity !== null ? hardPity - currentPity : null,
      averageSInterval: consistent ? pool.averageSInterval : null,
      sHistory,
      currentVersion: schedule.currentVersion,
      currentHistory,
      pastHistory,
      historyGroups: Array.from(groups, ([version, records2]) => ({ version, records: records2 })),
      currentFeatured: featured(schedule.current, id),
      upcomingFeatured,
      currentPhases,
      currentOpen: split ? schedule.openFor(id) : null,
      recentPhaseIds,
      unassignedPhaseCount: channelPhases?.unassigned || 0
    };
  });
  const featuredTotals = { pulls: 0, sCount: 0 };
  for (const channel2 of channels2) {
    if (!limitedChannels.has(channel2.id) && channel2.id !== "1") continue;
    featuredTotals.pulls += channel2.count;
    featuredTotals.sCount += channel2.rankCounts.S;
  }
  return {
    uid: account?.uid || "",
    total: analysis?.total || 0,
    rankCounts: analysis?.rankCounts || zeroCounts(),
    featuredTotals,
    firstTime,
    lastTime,
    channels: channels2
  };
}

// reviewed:tuning-wallet-platform.js
var officialWalletUrls = Object.freeze({
  cn: "https://act.mihoyo.com/zzz/event/gacha-record/index.html?game_biz=nap_cn&mhy_auth_required=1&mhy_presentation_style=fullscreen",
  global: "https://act.hoyolab.com/zzz/event/gacha-record/index.html?hyl_presentation_style=fullscreen"
});

// reviewed:tuning-records.js
var channels = [
  ["2", "独家频段", "Exclusive"],
  ["3", "音擎频段", "W-Engine"],
  ["102", "独家重映", "Rescreening"],
  ["103", "音擎回响", "Reverberation"],
  ["1", "常驻频段", "Stable"],
  ["5", "邦布频段", "Bangboo"]
];
var pageSize = { list: 30, grid: 20 };
var text = (zh, en) => window.DUKE_I18N?.language === "en" ? en : zh;
var translate = (value) => window.DUKE_I18N?.t(value) ?? value;
var fmt = (value) => Number.isFinite(value) ? value.toLocaleString(window.DUKE_I18N?.language || "zh-CN", { maximumFractionDigits: 1 }) : "—";
var node = (tag, cls, value) => {
  const el3 = document.createElement(tag);
  if (cls) el3.className = cls;
  if (value != null) el3.textContent = value;
  return el3;
};
function button(cls, label, action) {
  const el3 = node("button", cls, label);
  el3.type = "button";
  el3.onclick = action;
  return el3;
}
function metric(label, value) {
  const row = node("div", "record-metric");
  row.append(node("dt", "", label), node("dd", "", fmt(value)));
  return row;
}
function mountTuningRecords(root) {
  const overviewRow = root.querySelector(".record-overview");
  const namecard = overviewRow.querySelector(".record-namecard"), navigation = node("nav", "record-channel-tabs");
  const wallet = node("div", "record-wallet-host");
  wallet.id = "tuning-records-wallet";
  const details = node("div", "record-channel-detail");
  for (const region of [namecard, navigation, wallet, details]) region.dataset.i18nSkip = "";
  root.replaceChildren(overviewRow, document.getElementById("tuning-tools"), navigation, wallet, details);
  let state = {}, overview = null, selected = "2", layout = "grid", currentLayout = "list", range = "all", limit = pageSize.grid, currentLimit = pageSize.list, expanded = null;
  const availableChannels = () => overview?.channels.filter((c) => c.count || channels.some(([id]) => id === c.id)).map((c) => c.id) || channels.map((c) => c[0]);
  function label(id) {
    const names2 = channels.find((c) => c[0] === id);
    return names2 ? text(names2[1], names2[2]) : text("其他频段 " + id, "Other channel " + id);
  }
  const activeChannel = () => overview?.channels.find((c) => c.id === selected);
  const itemLabel = (r) => translate(state.itemName?.(r) || r.name || r.itemId || "");
  function avatar2(r) {
    const result = state.avatar?.(r) || node("span", "item-avatar", itemLabel(r).slice(0, 1) || "?");
    result.setAttribute("aria-hidden", "true");
    return result;
  }
  function select(id) {
    if (!availableChannels().includes(id)) return;
    selected = id;
    expanded = null;
    limit = pageSize[layout];
    currentLimit = pageSize[currentLayout];
    for (const button3 of navigation.querySelectorAll("[data-record-channel]")) button3.setAttribute("aria-pressed", String(button3.dataset.recordChannel === id));
    for (const button3 of namecard.querySelectorAll("[data-channel-summary]")) button3.setAttribute("aria-pressed", String(button3.dataset.channelSummary === id));
    renderDetails();
    state.onChannelChange?.(selected, overview);
    const tab = navigation.querySelector('[aria-pressed="true"]');
    if (tab && navigation.scrollWidth > navigation.clientWidth) navigation.scrollLeft += tab.getBoundingClientRect().left - navigation.getBoundingClientRect().left - (navigation.clientWidth - tab.offsetWidth) / 2;
  }
  function renderNamecard() {
    const identity = node("div", "record-identity"), title = node("div", "record-name-title"), info = node("div", "record-name-info");
    title.append(node("h1", "", text("调频统计", "Signal Search Stats")));
    title.append(node("span", "record-account", state.demo ? text("示例账号", "Demo account") : state.account ? "UID " + state.account.uid : text("尚未导入账号", "No account imported")));
    const sources = node("div", "record-official-links");
    for (const id of ["cn", "global"]) {
      const name = id === "cn" ? text("国服 · 米游社", "China · Miyoushe") : text("国际服 · HoYoLAB", "Global · HoYoLAB");
      const link = node("a", "record-official", name + " ↗");
      link.href = officialWalletUrls[id];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      sources.append(link);
    }
    info.append(title, sources);
    const portrait = node("div", "record-profile-art");
    const newest = overview?.channels.map((c) => c.sHistory[0]?.record).filter(Boolean).sort((a, b) => b.time.localeCompare(a.time))[0];
    if (newest) portrait.append(avatar2(newest));
    else {
      const brand = node("img", "");
      brand.src = "assets/brand/duke-patrick-sketch-v1-132.png";
      brand.alt = "";
      portrait.append(brand);
    }
    portrait.setAttribute("aria-hidden", "true");
    const totals = node("dl", "record-total-stats");
    totals.append(metric(text("累计调频", "Total searches"), overview?.featuredTotals.pulls), metric(text("S 级信号", "S-Rank signals"), overview?.featuredTotals.sCount));
    identity.append(portrait, info, totals);
    const actions = node("div", "record-name-actions");
    if (state.account && state.onShare) {
      const share = button("record-share", text("分享名片 ↗", "Share card ↗"), () => state.onShare?.({
        opener: share,
        overview,
        channelId: selected,
        layout,
        account: state.account,
        catalog: state.catalog,
        demo: state.demo
      }));
      actions.append(share);
    }
    const scope = node("p", "record-scope", state.account ? text("仅统计本账号已导入记录，名片总计不含邦布。", "Based on this account’s imported records. Totals exclude Bangboo.") : text("导入记录查看你的统计，也可以在对应区服的官方页面查看完整历史。", "Import records to see your stats, or open the official page for your region to see your full history."));
    const head = node("div", "record-name-head");
    head.append(identity, actions);
    const summaries = node("div", "record-channel-summaries");
    for (const [id] of channels) {
      const c = overview?.channels.find((channel2) => channel2.id === id), regular = id === "1" || id === "5";
      const tile = button("record-channel-summary", "", () => select(id));
      tile.dataset.channelSummary = id;
      tile.setAttribute("aria-pressed", String(selected === id));
      const count = node("span", "record-summary-count"), unit = node("small", "", text("抽", "pulls"));
      count.append(node("strong", "", fmt(c?.count)), unit);
      const rows = node("dl", "record-summary-metrics");
      const up = regular ? c?.rankCounts.S : c?.upCount, mean = regular ? c?.averageSInterval : c?.averageUpPulls;
      rows.append(metric(regular ? text("S级数量", "S-Rank count") : text("UP数量", "UP count"), up), metric(regular ? text("S级平均", "Avg. S") : text("UP平均", "Avg. UP"), mean));
      tile.title = text("查看", "View") + " " + label(id);
      tile.append(node("span", "record-summary-label", label(id)), count, rows);
      summaries.append(tile);
    }
    namecard.replaceChildren(head, summaries, scope);
  }
  function renderNavigation() {
    navigation.setAttribute("aria-label", text("选择调频频段", "Select a channel"));
    navigation.replaceChildren(...availableChannels().map((id) => {
      const tab = button("record-channel-tab", label(id), () => select(id));
      tab.dataset.recordChannel = id;
      tab.setAttribute("aria-pressed", String(selected === id));
      return tab;
    }));
  }
  function selectLayout(mode, period) {
    if (period !== "history") {
      currentLayout = mode;
      currentLimit = pageSize[mode];
    } else {
      layout = mode;
      limit = pageSize[mode];
    }
    expanded = null;
    renderDetails();
    details.querySelector('[data-period="' + period + '"] [data-record-layout="' + mode + '"]')?.focus({ preventScroll: true });
  }
  function layoutSwitch(period) {
    const switcher = node("div", "record-layout-switch");
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", text("记录展示方式", "Record layout"));
    for (const [key, zh, en] of [["list", "列表", "List"], ["grid", "网格", "Grid"]]) {
      const b = button("", text(zh, en), () => selectLayout(key, period));
      b.dataset.recordLayout = key;
      b.setAttribute("aria-pressed", String((period !== "history" ? currentLayout : layout) === key));
      switcher.append(b);
    }
    return switcher;
  }
  function entry(hit, c) {
    const r = hit.record, title = itemLabel(r), amount = hit.interval;
    const el3 = node("li", "record-hit");
    el3.dataset.outcome = hit.outcome;
    const ratio = Number.isFinite(amount) && c.hardPity ? Math.min(1, amount / c.hardPity) : null;
    el3.style.setProperty("--record-bar-width", ratio === null ? "19%" : 9 + 91 * ratio + "%");
    el3.dataset.tone = amount == null ? "unknown" : amount > 60 ? "late" : "early";
    const trigger = button("record-hit-button", "", () => {
      expanded = expanded === r ? null : r;
      const wasOpen = trigger.getAttribute("aria-expanded") === "true";
      for (const other of details.querySelectorAll(".record-hit.is-open")) {
        other.classList.remove("is-open");
        other.querySelector(".record-hit-detail").hidden = true;
        other.querySelector("button").setAttribute("aria-expanded", "false");
      }
      if (!wasOpen) {
        el3.classList.add("is-open");
        desc.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }
    });
    const numberLabel = fmt(amount), named = text(title + "，" + (amount == null ? "此前记录不完整" : numberLabel + " 抽") + (hit.outcome === "up" ? "，UP" : ""), title + " · " + (amount == null ? "Earlier records missing" : numberLabel + " pulls") + (hit.outcome === "up" ? " · UP" : ""));
    trigger.setAttribute("aria-label", named);
    trigger.title = named;
    const mark = node("span", "record-hit-mark"), bar = node("span", "record-hit-bar"), name = node("span", "record-hit-name", title);
    mark.append(avatar2(r));
    bar.append(node("b", "", numberLabel));
    if (hit.outcome === "up") bar.append(node("small", "record-up", "UP"));
    trigger.append(mark, bar, name);
    const desc = node("div", "record-hit-detail");
    desc.append(node("strong", "", title), node("time", "", r.time), node("span", "", amount == null ? text("上一次出 S 的记录不完整", "Previous S-Rank pull unknown") : text("本次间隔 " + numberLabel + " 抽", numberLabel + " pulls since the previous S-Rank")));
    const isOpen = expanded === r;
    desc.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) el3.classList.add("is-open");
    el3.append(trigger, desc);
    return el3;
  }
  function versionTag(version) {
    return version ? text(version + " 版本", "Version " + version) : text("版本待确认", "Version unknown");
  }
  function featured2(ids, title) {
    const wrap = node("div", "record-featured");
    if (!ids?.length) return wrap;
    wrap.append(node("span", "", title));
    for (const id of ids) {
      const r = { itemId: String(id), name: state.catalog?.[id]?.name || String(id), rank: "S" };
      const item = node("span", "record-featured-item");
      item.title = itemLabel(r);
      item.setAttribute("aria-label", item.title);
      item.setAttribute("role", "img");
      item.append(avatar2(r));
      wrap.append(item);
    }
    return wrap;
  }
  function entries(list, c, mode) {
    const group = node("ul", "record-hit-list " + (mode === "grid" ? "record-grid" : "record-bars"));
    group.append(...list.map((hit) => entry(hit, c)));
    return group;
  }
  function pityHint(c) {
    const hint = node("div", "record-pity");
    hint.append(node("span", "record-question", "?"));
    const summary = node("p", "");
    if (c.remainingPity != null) {
      const result = c.remainingIsUp ? text(" 次获得 S 级 UP 信号", " more searches for a featured S-Rank signal") : text(" 次获得 S 级信号", " more searches for an S-Rank signal");
      summary.append(text("至多再调频 ", "At most "), node("strong", "", fmt(c.remainingPity)), result);
    } else summary.textContent = text("此前调频记录不足，剩余保底次数待确定", "More history is needed to determine remaining pity");
    if (c.currentPity != null) summary.append(node("small", "record-pity-count", text("已垫 " + fmt(c.currentPity) + " 抽", fmt(c.currentPity) + " pulls since last S-Rank")));
    hint.append(summary);
    return hint;
  }
  function phaseTitle(phase) {
    const half = String(phase.half);
    const name = ["上半", "1"].includes(half) ? text("上半", "First half") : ["下半", "2"].includes(half) ? text("下半", "Second half") : phase.id;
    const end = phase.endLocal ? String(phase.endLocal).slice(0, 16) : null;
    if (phase.status === "past") return end ? text(name + " · " + end + " 已结束（服务器时间）", name + " · Ended " + end + " (server time)") : text(name + " · 已结束", name + " · Ended");
    if (phase.status === "active" && end) return text(name + " · " + end + " 截止（服务器时间）", name + " · Ends " + end + " (server time)");
    return name;
  }
  function currentSection(c) {
    const section = node("section", "record-signal-panel record-current");
    section.dataset.period = "current";
    const head = node("div", "record-panel-head"), heading = node("div", "");
    heading.append(node("h3", "", text("当前调频", "Current searches")), node("span", "record-version", versionTag(c.currentVersion)));
    head.append(heading, layoutSwitch("current"));
    section.append(head);
    const phases = c.currentPhases || [];
    const latestPhase = c.recentPhaseIds?.[0];
    const hasPhasePity = c.currentOpen === true || c.currentOpen === false && phases.some((p) => p.id === latestPhase);
    if (!phases.length && c.currentOpen === false) section.append(node("p", "record-no-hits", text("本版本当前未开放此频段", "This channel is currently closed")));
    if (!phases.length && c.currentOpen === true) section.append(pityHint(c));
    let left = currentLimit;
    for (const phase of phases) {
      const part = node("div", "record-phase");
      const header = node("div", "record-phase-head");
      header.append(node("h4", "record-history-version", phaseTitle(phase)), featured2(phase.featured, "UP"));
      part.append(header);
      if (hasPhasePity && (phase.status === "active" || c.currentOpen === false && phase.id === latestPhase)) part.append(pityHint(c));
      if (phase.records.length && left > 0) {
        part.append(entries(phase.records.slice(0, left), c, currentLayout));
        left -= Math.min(left, phase.records.length);
      }
      section.append(part);
    }
    const shownPhases = new Set(phases.map((phase) => phase.id));
    const unresolved = c.currentHistory.filter((hit) => !shownPhases.has(hit.phaseId));
    if (left > 0 && unresolved.length) section.append(node("h4", "record-history-version", text("期次待确认", "Phase unknown")), entries(unresolved.slice(0, left), c, currentLayout));
    if (!c.currentHistory.length && c.currentOpen !== false) section.append(node("p", "record-no-hits", c.currentVersion ? text("本版本尚无已导入的 S 级记录", "No S-Rank pulls imported for this version") : text("当前版本暂未确定，已导入记录可在下方查看", "The current version is unknown. See your imported history below.")));
    if (c.currentHistory.length > currentLimit) section.append(button("record-more", text("查看更多本期记录", "More current searches"), () => {
      currentLimit += pageSize[currentLayout];
      renderDetails();
    }));
    if (c.upcomingFeatured?.length) section.append(featured2(c.upcomingFeatured, text("调频预告", "Up next")));
    return section;
  }
  function historySection(c) {
    const period = c.split ? "history" : "all", mode = c.split ? layout : currentLayout, max = c.split ? limit : currentLimit;
    const section = node("section", "record-signal-panel record-history");
    section.dataset.period = period;
    const head = node("div", "record-panel-head");
    head.append(node("h3", "", c.split ? text("历史调频", "Past searches") : text("调频记录", "Search history")), layoutSwitch(period));
    section.append(head);
    const latestPhase = c.recentPhaseIds?.[0];
    if (c.hardPity && (!c.split || c.count && c.currentOpen === false && !c.currentPhases?.some((p) => p.id === latestPhase))) section.append(pityHint(c));
    let history2 = c.split ? c.pastHistory : c.sHistory;
    if (c.split && mode === "grid") {
      const scope = node("div", "record-range-switch");
      scope.setAttribute("role", "group");
      scope.setAttribute("aria-label", text("历史频段范围", "History range"));
      for (const [key, zh, en] of [["all", "全部", "All"], ["ended", "已结束", "Ended"]]) {
        const control = button("", text(zh, en), () => {
          range = key;
          limit = pageSize.grid;
          expanded = null;
          renderDetails();
          details.querySelector('[data-history-range="' + key + '"]')?.focus({ preventScroll: true });
        });
        control.dataset.historyRange = key;
        control.setAttribute("aria-pressed", String(range === key));
        scope.append(control);
      }
      section.append(scope);
      const endedPhases = new Set(c.currentPhases?.filter((p) => p.status === "past").map((p) => p.id));
      history2 = range === "all" ? c.sHistory : c.sHistory.filter((h) => endedPhases.has(h.phaseId) || c.currentVersion && h.version && h.version !== c.currentVersion);
    }
    const groups = /* @__PURE__ */ new Map();
    for (const hit of history2.slice(0, max)) {
      if (!groups.has(hit.version)) groups.set(hit.version, []);
      groups.get(hit.version).push(hit);
    }
    let first = true;
    for (const [version, hits] of groups) {
      const rows = entries(hits, c, mode);
      if (first && c.split && mode === "grid" && range === "all" && c.currentPity != null) {
        const tile = node("li", "record-grid-pity");
        tile.append(node("span", "record-question", "?"), node("b", "", text("已垫 " + fmt(c.currentPity), fmt(c.currentPity) + " pity")));
        rows.prepend(tile);
      }
      first = false;
      section.append(node("h4", "record-history-version", versionTag(version)), rows);
    }
    if (!history2.length) section.append(node("p", "record-no-hits", text("此范围暂无已导入的 S 级记录", "No S-Rank pulls imported for this range")));
    if (history2.length > max) section.append(button("record-more", text("更多记录", "More records"), () => {
      if (c.split) limit += pageSize[mode];
      else currentLimit += pageSize[mode];
      renderDetails();
    }));
    return section;
  }
  function renderDetails() {
    const c = activeChannel();
    if (!state.account || !c) {
      const box = node("section", "record-signal-panel record-empty");
      box.append(
        node("h3", "", text("查看我的调频记录", "View my Signal Search history")),
        node("p", "", text("可使用游戏记录链接、UIGF、JSON 或 CSV 文件。", "Use a history link or a UIGF, JSON or CSV file."))
      );
      details.replaceChildren(box);
      return;
    }
    const nodes = c.split ? [currentSection(c), historySection(c)] : [historySection(c)];
    details.replaceChildren(...nodes);
  }
  function draw() {
    renderNamecard();
    renderNavigation();
    renderDetails();
    state.onChannelChange?.(selected, overview);
  }
  return { render(next) {
    const accountChanged = state.account?.uid !== next.account?.uid || state.demo !== next.demo;
    if (accountChanged) {
      limit = pageSize[layout];
      currentLimit = pageSize[currentLayout];
      expanded = null;
    }
    if (!next.account) overview = null;
    else if (next.account !== state.account || next.analysis !== state.analysis || next.calendar !== state.calendar || next.banners !== state.banners || next.versionStarts !== state.versionStarts || next.region !== state.region || next.now !== state.now) {
      overview = buildRecordOverview(next.account, { stats: next.analysis, catalog: next.catalog, banners: next.banners, calendar: next.calendar, versionStarts: next.versionStarts, now: next.now, region: next.region });
    }
    if (accountChanged && !activeChannel()?.count) selected = overview?.channels.find((c) => c.count)?.id || "2";
    state = next;
    draw();
  } };
}

// reviewed:tuning-wallet-store.js
import { BUDGET_STORAGE_KEY, newBudget, recordedWallet, applyRecordedWallet } from "./tuning-personal-budget-core.js?v=20261118-tuning-records-launch-1";
function createWalletStore(onExternalChange) {
  const drafts = /* @__PURE__ */ new Map([["manual", newBudget()]]);
  const pending = /* @__PURE__ */ new Map();
  const demo2 = newBudget();
  applyRecordedWallet(demo2, { polychrome: 1412, monochrome: 7487, encryptedTapes: 35, masterTapes: 8, boopons: 24 });
  drafts.set("demo", demo2);
  let scope = "manual";
  const persistent2 = () => scope.startsWith("account:");
  const storageKey = () => BUDGET_STORAGE_KEY + ":" + scope;
  function readStored() {
    const value = localStorage.getItem(storageKey());
    if (value === null) return newBudget();
    const draft = JSON.parse(value);
    if (draft?.version !== 1) throw new TypeError("Unsupported wallet storage version");
    return draft;
  }
  function reload() {
    if (!drafts.has(scope)) drafts.set(scope, newBudget());
    if (!persistent2()) return;
    try {
      const latest = readStored();
      if (pending.has(scope)) applyRecordedWallet(latest, pending.get(scope));
      drafts.set(scope, latest);
    } catch {
    }
  }
  window.addEventListener("storage", (event) => {
    if (!persistent2() || event.key !== null && event.key !== storageKey()) return;
    reload();
    onExternalChange();
  });
  return {
    select(next) {
      if (scope === next) return;
      scope = next;
      reload();
    },
    getWallet() {
      return recordedWallet(drafts.get(scope));
    },
    setWallet(changes) {
      applyRecordedWallet(drafts.get(scope), changes);
      if (!persistent2()) return true;
      const edits = { ...pending.get(scope), ...changes };
      try {
        const latest = readStored();
        applyRecordedWallet(latest, edits);
        localStorage.setItem(storageKey(), JSON.stringify(latest));
        drafts.set(scope, latest);
        pending.delete(scope);
        return true;
      } catch {
        pending.set(scope, edits);
        return false;
      }
    }
  };
}

// reviewed:tuning-records-wallet.js
var packedWalletIcons = { "boopons": "data:image/webp;base64,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", "encryptedTapes": "data:image/webp;base64,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", "masterTapes": "data:image/webp;base64,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", "monochrome": "data:image/webp;base64,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", "polychrome": "data:image/webp;base64,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" };
var items = {
  polychrome: ["菲林", "Polychrome"],
  monochrome: ["菲林底片", "Monochrome"],
  encryptedTapes: ["加密母带", "Encrypted Master Tapes"],
  masterTapes: ["原装母带", "Master Tapes"],
  boopons: ["邦布券", "Boopons"]
};
var text2 = (zh, en) => window.DUKE_I18N?.language === "en" ? en : zh;
function el(tag, label, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (label !== null) n.textContent = label;
  return n;
}
var button2 = (label, action) => {
  const b = el("button", label);
  b.type = "button";
  b.onclick = action;
  return b;
};
function mountRecordWallet(host) {
  let channel2 = "", scope = "", converted = false, dialog = null, notice = "";
  const store = createWalletStore(() => {
    notice = "";
    draw();
  });
  function edit() {
    if (dialog?.open) return;
    const original = store.getWallet();
    const form = el("form", null);
    dialog = el("dialog", null, "tuning-wallet-dialog");
    dialog.setAttribute("aria-labelledby", "wallet-dialog-title");
    dialog.dataset.i18nSkip = "";
    const heading = el("h2", text2("我的调频资源", "My Signal Search resources"));
    heading.id = "wallet-dialog-title";
    form.append(heading, el("p", text2("填写当前余额，留空表示未知。", "Enter current balances. Leave unknown amounts blank.")));
    for (const [key, names2] of Object.entries(items)) {
      const label = el("label", text2(...names2)), input = el("input", null);
      input.name = key;
      input.type = "number";
      input.min = "0";
      input.max = "1000000000";
      input.step = "1";
      input.inputMode = "numeric";
      input.value = original[key] ?? "";
      input.placeholder = "—";
      label.append(input);
      form.append(label);
    }
    const buttons = el("div", null, "record-wallet-actions");
    const submit = el("button", text2("保存", "Save"));
    submit.type = "submit";
    buttons.append(button2(text2("取消", "Cancel"), () => dialog.close()), submit);
    form.append(buttons);
    form.onsubmit = (event) => {
      event.preventDefault();
      const changes = {};
      for (const key of Object.keys(items)) {
        const field = form.elements.namedItem(key), value = field.value === "" ? null : field.valueAsNumber;
        if (value !== original[key]) changes[key] = value;
      }
      if (Object.keys(changes).length) {
        const stored = store.setWallet(changes);
        notice = stored ? "" : text2("本次余额仅保存在内存中。", "Balances are available for this session only.");
      }
      dialog.close();
      draw();
    };
    dialog.append(form);
    const current = dialog;
    current.addEventListener("close", () => {
      current.remove();
      if (dialog === current) dialog = null;
      host.querySelector("[data-wallet-edit]")?.focus({ preventScroll: true });
    }, { once: true });
    document.body.append(current);
    current.showModal();
  }
  function draw() {
    const wallet = store.getWallet(), row = recordWallet(wallet, channel2);
    host.hidden = scope === "manual" || !row.ticketKind;
    if (host.hidden) {
      host.replaceChildren();
      return;
    }
    const header = el("div", null, "record-wallet-head");
    header.append(el("strong", text2("调频资源", "Signal Search resources")));
    const editButton = button2(text2("手动录入", "Enter manually"), edit);
    editButton.dataset.walletEdit = "";
    if (row.canConvert) {
      const swap = button2(converted ? text2("查看原始资源", "Show balances") : text2("折算加密母带", "Convert to tapes"), () => {
        converted = !converted;
        draw();
        host.querySelector("[data-wallet-convert]")?.focus({ preventScroll: true });
      });
      swap.dataset.walletConvert = "";
      swap.setAttribute("aria-pressed", String(converted));
      header.append(swap);
    }
    header.append(editButton);
    const values = el("div", null, "record-wallet-values");
    const keys = converted && row.canConvert ? [row.ticketKind] : channel2 === "5" ? [row.ticketKind] : ["polychrome", "monochrome", row.ticketKind];
    for (const key of keys) {
      const card = el("div", null, "record-wallet-item"), info = el("div", null), icon = el("img", null);
      icon.src = packedWalletIcons[key];
      icon.alt = "";
      icon.width = 36;
      icon.height = 36;
      const total = converted && row.canConvert, amount = total ? row.equivalentPulls : wallet[key];
      const amountEl = el("strong", amount === null ? "—" : amount.toLocaleString(window.DUKE_I18N?.language || "zh-CN"));
      amountEl.dataset.walletValue = key;
      let label = text2(...items[key]);
      if (total) label = row.partial ? text2("折合加密母带（按已录入资源）", "Equivalent tapes (entered balances)") : text2("折合加密母带", "Equivalent tapes");
      info.append(el("small", label), amountEl);
      card.append(icon, info);
      values.append(card);
    }
    const note = converted && row.canConvert ? text2("已有加密母带直接计入，菲林和底片合计每满 160 可换 1 个。", "Includes owned tapes plus one for every 160 combined Polychromes and Monochromes.") : scope === "demo" ? text2("示例余额", "Demo balances") : text2("— 表示尚未录入。", "A dash marks a balance you haven’t entered.");
    const status = el("small", notice || note, "record-wallet-note");
    status.setAttribute("role", "status");
    host.replaceChildren(header, values, status);
  }
  return { update(channelId, accountScope) {
    if (scope !== accountScope) {
      dialog?.close();
      converted = false;
    }
    if (scope !== accountScope || String(channelId) !== channel2) notice = "";
    scope = accountScope;
    channel2 = String(channelId);
    store.select(scope);
    draw();
  } };
}

// reviewed:tuning-records-share.js
var englishChannels = { "2": "Exclusive Channel", "3": "W-Engine Channel", "102": "Exclusive Rescreening", "103": "W-Engine Reverberation", "1": "Stable Channel", "5": "Bangboo Channel" };
var styleUrl = new URL("./tuning-simple.css?v=20261118-reviewed-ui-launch-1", import.meta.url).href;
var WIDTH = 720;
var TOP = 160;
var LIMIT = 3600;
var GRID = 98;
var LIST = 64;
var SUBHEAD = 56;
var FOOT = 52;
var FONT = '"Segoe UI","Microsoft YaHei",sans-serif';
var ink = {
  page: "#101322",
  surface: "#202336",
  tile: "#292d45",
  track: "#343a54",
  rule: "#454c68",
  text: "#f0f2fc",
  muted: "#bcc3da",
  header: "#e9edff",
  headerText: "#282e54",
  headerMuted: "#535b7b",
  accent: "#7588ff",
  headerAccent: "#4356bf",
  gold: "#765911",
  up: "#f3cf78",
  early: "#76c8b9",
  late: "#e3ae62",
  unknown: "#a6afc5",
  onBar: "#20263b"
};
function sharedHits(channel2, hits, layout) {
  if (layout === "grid") return hits.slice(0, 100);
  if (!channel2.split) return hits.slice(0, 30);
  const phases = new Set(channel2.recentPhaseIds);
  return hits.filter((hit) => hit.phaseId && phases.has(hit.phaseId));
}
function buildCard(overview, options, words) {
  const pages = [], selected = overview.channels.filter((ch) => options.poolId === String(ch.id));
  const top = TOP + (options.details ? Math.ceil(overview.channels.length / 3) * 55 + 9 : 0);
  let page2 = { sections: [], height: top };
  const pushPage = () => {
    if (page2.sections.length) pages.push(page2);
    page2 = { sections: [], height: top };
  };
  for (const ch of selected) {
    const restricted = options.scope === "current" && ch.split;
    const hits = restricted ? ch.currentHistory : ch.sHistory;
    const total = restricted ? ch.currentCount : ch.count;
    const ranks = restricted ? ch.currentRankCounts : ch.rankCounts;
    const name = words(ch.label, englishChannels[ch.id] || ch.label);
    const scope = restricted ? ch.currentVersion || words("当前版本", "Current version") : words("所有记录", "All records");
    const pity = options.layout === "list" && ch.split && Number.isFinite(ch.currentPity) ? [{ pity: true, interval: ch.currentPity }] : [];
    const slots = pity.concat(sharedHits(ch, hits, options.layout));
    const perRow = options.layout === "grid" ? 5 : 1, rowHeight = options.layout === "grid" ? GRID : LIST;
    let offset = 0;
    do {
      if (page2.height + SUBHEAD + (slots.length ? rowHeight : 0) > LIMIT) pushPage();
      const room = Math.floor((LIMIT - page2.height - SUBHEAD) / rowHeight) * perRow;
      const entries = slots.slice(offset, offset + room);
      page2.sections.push({ name, scope, count: total, sCount: ranks?.S ?? null, entries, continued: offset > 0 });
      page2.height += SUBHEAD + Math.ceil(entries.length / perRow) * rowHeight;
      offset += entries.length;
      if (offset < slots.length) pushPage();
    } while (offset < slots.length);
  }
  pushPage();
  return { pages, top, pulls: overview.featuredTotals.pulls, sCount: overview.featuredTotals.sCount };
}
function picture(meta, cache) {
  const path = meta?.icon;
  if (!/^assets\/tuning\/[a-zA-Z0-9_-]+\.(?:webp|png)$/.test(path || "")) return Promise.resolve(null);
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = new URL(path, document.baseURI).href;
    }));
  }
  return cache.get(path);
}
async function drawCard(model, index, opts, context, words, cache, preview = false) {
  const full = model.pages[index], canvas = document.createElement("canvas"), grid = opts.layout === "grid";
  const sections = preview && grid ? full.sections.map((s) => ({ ...s, entries: s.entries.slice(0, 20) })) : full.sections;
  const body = sections.reduce((h, s) => h + SUBHEAD + Math.ceil(s.entries.length / (grid ? 5 : 1)) * (grid ? GRID : LIST), model.top);
  canvas.width = WIDTH;
  canvas.height = body + FOOT;
  const paint = canvas.getContext("2d");
  if (!paint) throw new Error("canvas");
  const items2 = context.catalog?.items || context.catalog || {};
  const metadata2 = (hit) => items2[hit.record?.itemId];
  const portraits = /* @__PURE__ */ new Map();
  const visible = sections.flatMap((s) => s.entries).filter((e) => !e.pity);
  await Promise.all(visible.map(async (hit) => portraits.set(hit, await picture(metadata2(hit), cache))));
  function fill(x, y2, w, h, color2) {
    paint.fillStyle = color2;
    paint.fillRect(x, y2, w, h);
  }
  function text3(value, x, y2, size, weight = 600, color2 = ink.text, width) {
    paint.fillStyle = color2;
    paint.font = weight + " " + size + "px " + FONT;
    const source = String(value ?? "—");
    if (width == null || paint.measureText(source).width <= width) {
      paint.fillText(source, x, y2);
      return;
    }
    let shortened = "";
    for (const ch of source) {
      if (paint.measureText(shortened + ch + "…").width > width) break;
      shortened += ch;
    }
    paint.fillText(shortened + "…", x, y2);
  }
  const number2 = (value) => Number.isFinite(value) ? value.toLocaleString(words("zh-CN", "en-US")) : "—";
  const color = (entry) => entry.pity || !Number.isFinite(entry.interval) ? ink.unknown : entry.interval <= 60 ? ink.early : ink.late;
  function entryName(entry) {
    if (entry.pity) return words("已垫抽数", "Pity");
    const meta = metadata2(entry);
    return words(meta?.name, meta?.aliases?.find((alias) => /^[A-Za-z]/.test(alias)) || meta?.name) || entry.record?.name || entry.record?.itemId || "—";
  }
  function avatar2(entry, x, y2, d) {
    paint.save();
    paint.beginPath();
    paint.arc(x + d / 2, y2 + d / 2, d / 2, 0, Math.PI * 2);
    paint.clip();
    fill(x, y2, d, d, ink.track);
    const art = portraits.get(entry);
    if (art) paint.drawImage(art, x, y2, d, d);
    else {
      paint.textAlign = "center";
      text3(entry.pity ? "?" : Array.from(entryName(entry))[0], x + d / 2, y2 + d * 0.73, d * 0.6, 800);
      paint.textAlign = "left";
    }
    paint.restore();
  }
  function up(entry, x, y2) {
    if (entry.outcome !== "up") return;
    fill(x, y2, 26, 17, ink.up);
    text3("UP", x + 3, y2 + 13, 13, 900, ink.onBar);
  }
  fill(0, 0, WIDTH, canvas.height, ink.page);
  fill(18, 16, 684, 113, ink.header);
  fill(18, 16, 8, 113, ink.accent);
  text3(context.demo ? words("示例 · 调频统计", "Example · Signal Search Stats") : words("调频统计", "Signal Search Stats"), 38, 57, 30, 850, ink.headerText, 300);
  const uid = String(context.overview.uid || "");
  text3(uid && !context.demo ? "UID · " + (uid.length > 4 ? "••••" + uid.slice(-4) : "••••") : words("DUKE 调频名片", "DUKE Signal Search card"), 39, 92, 16, 650, ink.headerMuted, 270);
  text3(number2(model.pulls), 353, 69, 35, 850, ink.headerAccent, 160);
  text3(words("总调频次数", "Total searches"), 354, 100, 15, 600, ink.headerMuted);
  text3(number2(model.sCount), 552, 69, 35, 850, ink.gold, 131);
  text3(words("总 S 级信号", "Total S-Ranks"), 553, 100, 15, 600, ink.headerMuted);
  text3(words("已导入记录 · 顶部合计不含邦布", "Imported history · Header totals exclude Bangboo"), 27, 150, 14, 600, ink.muted);
  if (opts.details) context.overview.channels.forEach((ch, i) => {
    const x = 22 + i % 3 * 228, yy = TOP + Math.floor(i / 3) * 55, regular = !ch.split;
    fill(x, yy, 218, 50, ink.tile);
    text3(words(ch.label, englishChannels[ch.id] || ch.label), x + 7, yy + 19, 13, 650, ink.muted, 120);
    text3(number2(ch.count) + words(" 抽", " pulls"), x + 131, yy + 19, 13, 700, ink.text, 78);
    const kind = regular ? "S" : "UP", count = regular ? ch.rankCounts.S : ch.upCount, avg = regular ? ch.averageSInterval : ch.averageUpPulls;
    text3(kind + " " + number2(count) + " · " + words("平均 ", "Avg. ") + number2(avg), x + 7, yy + 40, 13, 650, ink.text, 202);
  });
  let y = model.top;
  for (const section of sections) {
    fill(20, y, 680, 47, ink.surface);
    fill(20, y, 4, 47, ink.accent);
    text3(section.name + (section.continued ? words(" · 续", " · cont.") : ""), 32, y + 30, 21, 800, ink.text, 261);
    text3(section.scope, 310, y + 29, 15, 600, ink.muted, 131);
    text3(number2(section.count) + words(" 抽", " pulls") + " · S " + number2(section.sCount), 461, y + 30, 19, 700, ink.text, 220);
    y += SUBHEAD;
    for (const [i, entry] of section.entries.entries()) {
      const amt = number2(entry.interval);
      if (opts.layout === "grid") {
        const x = 22 + i % 5 * 136, top = y + Math.floor(i / 5) * GRID;
        fill(x, top, 128, 89, ink.surface);
        avatar2(entry, x + 6, top + 6, 49);
        text3(amt, x + 62, top + 44, 23, 800, color(entry), 59);
        text3(entryName(entry), x + 7, top + 73, 15, 600, ink.text, 113);
        fill(x, top + 83, 128, 5, color(entry));
        up(entry, x + 99, top + 3);
      } else {
        const top = y + i * LIST, name = entryName(entry);
        avatar2(entry, 29, top + 3, 48);
        text3(name, 88, top + 22, 18, 700, ink.text, 205);
        const version = entry.pity ? "" : entry.version || words("版本待确认", "Version unknown");
        text3(version, 88, top + 44, 14, 500, ink.muted, 200);
        fill(308, top + 9, 371, 35, ink.track);
        const bar = Number.isFinite(entry.interval) ? Math.min(371, Math.max(53, entry.interval / 90 * 371)) : 55;
        fill(308, top + 9, bar, 35, color(entry));
        text3(amt, 317, top + 34, 22, 800, ink.onBar);
        up(entry, 651, top + 9);
      }
    }
    y += Math.ceil(section.entries.length / (opts.layout === "grid" ? 5 : 1)) * (opts.layout === "grid" ? GRID : LIST);
  }
  fill(20, y + 6, 680, 1, ink.rule);
  text3("DUKE · " + words("绝区零", "Zenless Zone Zero"), 25, y + 34, 16, 700, ink.muted);
  text3(index + 1 + " / " + model.pages.length, 620, y + 34, 16, 700, ink.muted, 75);
  return canvas;
}
function openTuningRecordShare(context) {
  const { overview, opener } = context;
  if (!overview?.channels?.length || document.querySelector("dialog.tuning-share-dialog")) return;
  if (!document.querySelector("link[data-tuning-share-css]")) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = styleUrl;
    css.dataset.tuningShareCss = "";
    document.head.append(css);
  }
  const english = (window.DUKE_I18N?.language || document.documentElement.lang || "").startsWith("en");
  const w = (zh, en) => english ? en : zh;
  const make = (tag, content, cls) => {
    const n = document.createElement(tag);
    if (content != null) n.textContent = content;
    if (cls) n.className = cls;
    return n;
  };
  const button3 = (label, fn) => {
    const n = make("button", label);
    n.type = "button";
    n.addEventListener("click", fn);
    return n;
  };
  const options = { poolId: String(context.channelId || overview.channels[0].id), scope: "current", layout: "list", details: true };
  const dialog = make("dialog", null, "tuning-share-dialog");
  dialog.setAttribute("aria-labelledby", "tuning-share-heading");
  const header = make("header"), title = make("h2", w("分享调频统计", "Share Signal Search stats"));
  title.id = "tuning-share-heading";
  const close = button3(w("关闭", "Close"), () => dialog.close());
  header.append(title, close);
  dialog.append(header);
  const preview = make("div", null, "tuning-share-preview");
  const status = make("p", null, "tuning-share-status");
  status.setAttribute("role", "status");
  const channelGroup = make("fieldset"), legend = make("legend", w("选择频段", "Channels"));
  channelGroup.append(legend);
  for (const ch of overview.channels) {
    const id = String(ch.id), label = make("label"), input = make("input");
    input.type = "radio";
    input.name = "tuning-share-channel";
    input.value = id;
    input.checked = options.poolId === id;
    input.onchange = () => {
      options.poolId = id;
      update();
    };
    label.append(input, w(ch.label, englishChannels[id] || ch.label));
    channelGroup.append(label);
  }
  const config = make("div", null, "tuning-share-config");
  function select(label, key, choices) {
    const wrap = make("label", label), el3 = make("select");
    for (const [value, name] of choices) {
      const option = make("option", name);
      option.value = value;
      el3.append(option);
    }
    el3.value = options[key];
    el3.onchange = () => {
      options[key] = el3.value;
      update();
    };
    wrap.append(el3);
    config.append(wrap);
  }
  select(w("记录范围", "Record range"), "scope", [["all", w("全部记录", "All records")], ["current", w("当前版本", "Current version")]]);
  select(w("数据样式", "Card layout"), "layout", [["grid", w("网格", "Grid")], ["list", w("列表", "List")]]);
  const detail = make("label"), toggle = make("input");
  toggle.type = "checkbox";
  toggle.checked = options.details;
  toggle.onchange = () => {
    options.details = toggle.checked;
    update();
  };
  detail.append(toggle, w("个人名片展示调频统计", "Include channel totals on the namecard"));
  config.append(detail);
  const limits = make("p", null, "tuning-share-status");
  const tools = make("div", null, "tuning-share-actions"), pages = make("div", null, "tuning-share-pages");
  const prev = button3(w("上一张", "Previous"), () => update(pageIndex - 1)), next = button3(w("下一张", "Next"), () => update(pageIndex + 1)), counter = make("span");
  pages.append(prev, counter, next);
  const save = button3(w("保存 PNG", "Save PNG"), () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), a = make("a");
    a.href = url;
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
    status.textContent = w("已开始保存这张名片。", "Downloading this card.");
  });
  const share = button3(w("系统分享", "Share image"), async () => {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], fileName(), { type: "image/png" })] });
      status.textContent = w("名片已分享。", "Card shared.");
    } catch (err) {
      if (err.name !== "AbortError") status.textContent = w("系统分享暂不可用，可保存 PNG。", "Sharing is unavailable. You can save the PNG.");
    }
  });
  tools.append(save, share);
  dialog.append(channelGroup, config, limits, preview, pages, status, tools);
  document.body.append(dialog);
  let revision = 0, pageIndex = 0, blob = null;
  const imageCache = /* @__PURE__ */ new Map(), fileName = () => "DUKE-signal-search-" + (context.demo ? "demo-" : "") + (pageIndex + 1) + ".png";
  async function update(index = 0) {
    const ticket = ++revision;
    blob = null;
    save.disabled = true;
    share.hidden = true;
    prev.disabled = true;
    next.disabled = true;
    preview.replaceChildren();
    pages.hidden = true;
    limits.textContent = options.layout === "grid" ? w("网格预览最近 20 条 S 级记录，保存时最多收录 100 条。", "The grid previews the latest 20 S-Ranks. The saved image includes up to 100.") : w("列表收录最近参与的 5 个已知档期。未匹配档期的限定记录可在网格查看。常驻与邦布各取最近 30 条 S 级记录。", "Lists show the latest five known banner periods you entered. Grid view includes unassigned limited records. Stable and Bangboo show up to 30 recent S-Ranks each.");
    const model = buildCard(overview, options, w);
    if (!model.pages.length) return;
    pageIndex = Math.max(0, Math.min(index, model.pages.length - 1));
    status.textContent = w("正在生成名片…", "Preparing card…");
    try {
      const canvas = await drawCard(model, pageIndex, options, context, w, imageCache);
      const output = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!output) throw new Error("png");
      if (ticket !== revision || !dialog.open) return;
      const visible = options.layout === "grid" && model.pages[pageIndex].sections.some((s) => s.entries.length > 20) ? await drawCard(model, pageIndex, options, context, w, imageCache, true) : canvas;
      if (ticket !== revision || !dialog.open) return;
      blob = output;
      visible.setAttribute("role", "img");
      visible.setAttribute("aria-label", w("调频名片预览", "Signal Search card preview"));
      preview.replaceChildren(visible);
      save.disabled = false;
      prev.disabled = pageIndex === 0;
      next.disabled = pageIndex === model.pages.length - 1;
      pages.hidden = model.pages.length === 1;
      counter.textContent = pageIndex + 1 + " / " + model.pages.length;
      status.textContent = model.pages.length > 1 ? w("共 " + model.pages.length + " 张，可翻页逐张保存。", model.pages.length + " cards. Use the arrows to save each page.") : "";
      if (navigator.canShare && navigator.share && typeof File === "function") {
        try {
          share.hidden = !navigator.canShare({ files: [new File([blob], fileName(), { type: "image/png" })] });
        } catch {
        }
      }
    } catch {
      if (ticket === revision) status.textContent = w("名片生成失败。请重新选择频段后再试。", "Could not create the card. Select a channel to try again.");
    }
  }
  dialog.addEventListener("close", () => {
    revision++;
    dialog.remove();
    imageCache.clear();
    blob = null;
    if (opener?.isConnected) opener.focus();
  }, { once: true });
  dialog.showModal();
  update();
}

// reviewed:tuning-version-starts.js
var versionStarts = [
  { version: "1.0", startAt: Date.parse("2024-07-03T22:00+00:00") },
  { version: "1.1", startAt: Date.parse("2024-08-13T22:00+00:00") },
  { version: "1.2", startAt: Date.parse("2024-09-24T22:00+00:00") },
  { version: "1.3", startAt: Date.parse("2024-11-05T22:00+00:00") },
  { version: "1.4", startAt: Date.parse("2024-12-17T22:00+00:00") },
  { version: "1.5", startAt: Date.parse("2025-01-21T22:00+00:00") },
  { version: "1.6", startAt: Date.parse("2025-03-11T22:00+00:00") },
  { version: "1.7", startAt: Date.parse("2025-04-22T22:00+00:00") },
  { version: "2.0", startAt: Date.parse("2025-06-05T22:00+00:00") },
  { version: "2.1", startAt: Date.parse("2025-07-15T22:00+00:00") },
  { version: "2.2", startAt: Date.parse("2025-09-03T22:00+00:00") },
  { version: "2.3", startAt: Date.parse("2025-10-14T22:00+00:00") },
  { version: "2.4", startAt: Date.parse("2025-11-25T22:00+00:00") },
  { version: "2.5", startAt: Date.parse("2025-12-29T22:00+00:00") },
  { version: "2.6", startAt: Date.parse("2026-02-05T22:00+00:00") },
  { version: "2.7", startAt: Date.parse("2026-03-23T22:00+00:00") },
  { version: "2.8", startAt: Date.parse("2026-05-05T22:00+00:00") },
  { version: "3.0", startAt: Date.parse("2026-06-16T22:00+00:00") },
  { version: "3.1", startAt: Date.parse("2026-07-28T22:00+00:00") },
  { version: "3.2", startAt: Date.parse("2026-09-08T22:00+00:00") },
  { version: "3.3", startAt: Date.parse("2026-10-20T22:00+00:00") }
];

// reviewed:tuning.js
var $ = (id) => document.getElementById(id);
var el2 = (tag, className, text3) => {
  const node2 = document.createElement(tag);
  if (className) node2.className = className;
  if (text3 != null) node2.textContent = text3;
  return node2;
};
var nf = new Intl.NumberFormat("zh-CN");
var number = (n) => nf.format(n || 0);
var labels = { "2": "独家频段", "3": "音擎频段", "1": "常驻频段", "5": "邦布频段", "102": "独家重映", "103": "音擎回响", agents: "代理人总览", engines: "音擎总览" };
var PAGE_SIZE = 10;
var accounts = [];
var selectedUid = "";
var selectedTab = "2";
var demo = null;
var stats = null;
var page = 0;
var busy = false;
var collectionLimit = 48;
var tuningWorkspace;
var recordView;
var recordWalletView;
var recordScope;
var banners = null;
var calendar = null;
var checkpoints = {};
var refreshPending = false;
var catalog = {};
var names = /* @__PURE__ */ new Map();
var catalogError = false;
var channel;
try {
  channel = new BroadcastChannel("bagel-tuning-records");
} catch {
}
function announce(message, kind = "info") {
  $("status-message").textContent = message;
  $("status-message").dataset.kind = kind;
}
var activeAccounts = () => demo ? [demo] : accounts;
var active = () => activeAccounts().find((a) => a.uid === selectedUid) || activeAccounts()[0];
function setArchive(state) {
  accounts = state.accounts;
  checkpoints = state.checkpoints || {};
}
window.addEventListener("dukelanguagechange", () => {
  updateRecordView();
  if (window.tuningAnalysis) renderOpenTools();
});
async function syncAccounts() {
  if (busy) {
    refreshPending = true;
    return;
  }
  refreshPending = false;
  try {
    setArchive(await readImportState());
    render();
    if (!demo && $("status-message").dataset.kind !== "error") announce("已同步其他标签页中的本地记录。");
  } catch (error) {
    announce(`本地记录同步失败：${error.message}。当前显示的记录仍在。`, "warning");
  }
}
function finishUpdate() {
  busy = false;
  render();
  if (refreshPending) void syncAccounts();
}
var metadata = (record) => catalog[record.itemId] || names.get(record.name);
var itemName = (record) => metadata(record)?.name || record.name || `物品 ${record.itemId || "未知"}`;
function itemType(record) {
  const known = metadata(record)?.type;
  if (known) return known;
  const value = String(record.itemType || "").toLowerCase();
  if (/代理人|角色|agent|character|avatar/.test(value)) return "agent";
  if (/音擎|weapon|w.engine/.test(value)) return "engine";
  if (/邦布|bangboo|buddy/.test(value)) return "bangboo";
  return "unknown";
}
function avatar(record) {
  const wrap = el2("span", "item-avatar");
  wrap.dataset.rank = record.rank || "unknown";
  const known = metadata(record);
  if (known?.icon && /^assets\/tuning\/[a-zA-Z0-9_./-]+\.(webp|png)$/.test(known.icon)) {
    const img = document.createElement("img");
    img.src = known.icon;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => {
      img.remove();
      wrap.textContent = itemName(record).slice(0, 1);
      wrap.title = "图标暂缺";
    }, { once: true });
    wrap.append(img);
  } else {
    wrap.textContent = itemName(record).slice(0, 1);
    wrap.title = "尚未匹配到图标";
  }
  return wrap;
}
function badge(rank) {
  const node2 = el2("span", "rank-badge", rank ? `${rank} 级` : "未知");
  node2.dataset.rank = rank || "unknown";
  return node2;
}
function aggregates(account, kind) {
  const groups = /* @__PURE__ */ new Map();
  for (const r of account.records) {
    if (itemType(r) !== kind) continue;
    const known = metadata(r), key = known?.id || r.itemId || r.name;
    if (!groups.has(key)) groups.set(key, { ...r, name: itemName(r), count: 0, rankCounts: { S: 0, A: 0, B: 0, unknown: 0 }, qualities: /* @__PURE__ */ new Set(), pools: /* @__PURE__ */ new Set(), first: r.time, last: r.time });
    const row = groups.get(key);
    row.count++;
    row.pools.add(r.pool);
    row.rankCounts[r.rank || "unknown"]++;
    if (r.rank) row.qualities.add(r.rank);
    if (r.time < row.first) row.first = r.time;
    if (r.time > row.last) row.last = r.time;
  }
  return [...groups.values()].map((row) => ({ ...row, rank: metadata(row)?.rank || (row.qualities.size === 1 ? [...row.qualities][0] : null) }));
}
function renderGuaranteeHub(account) {
  const cards = $("guarantee-cards");
  cards.replaceChildren();
  cards.hidden = !account;
  $("guarantee-empty").hidden = !!account;
  $("guarantee-account").textContent = account ? demo ? "虚构示例 · 最新已导入记录" : `UID ${String(account.uid).slice(0, 2)}***${String(account.uid).slice(-4)} · 最新记录` : "导入后显示你的状态";
  if (!account) return;
  for (const id of ["2", "3"]) {
    const article = el2("article", "guarantee-pool");
    article.dataset.guaranteePool = id;
    article.append(el2("h3", "", id === "2" ? "独家频段 · 代理人" : "音擎频段 · 限定音擎"));
    const pool = stats.pools.find((p) => p.id === id) || POOL_META2[id];
    renderGuarantee(article, account, pool, { catalog, includeGuide: false, includeScope: false });
    cards.append(article);
  }
}
function renderHistory(account) {
  const query = $("record-search").value.trim().toLowerCase(), rank = $("rank-filter").value;
  const rows = account.records.filter((r) => r.pool === selectedTab && (rank === "all" || (rank === "unknown" ? !r.rank : r.rank === rank)) && (!query || window.DUKE_I18N.matches([itemName(r), r.name, r.itemId, r.time], query))).slice().reverse();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, totalPages - 1);
  $("history-body").replaceChildren(...rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => {
    const tr = el2("tr"), name = el2("td"), nameRow = el2("div", "record-item");
    nameRow.append(avatar(r), el2("span", "record-name", itemName(r)));
    name.append(nameRow);
    const quality = el2("td");
    quality.append(badge(r.rank));
    tr.append(name, quality, el2("td", "", labels[r.pool] || r.pool), el2("td", "record-time", r.time));
    return tr;
  }));
  $("history-count").textContent = `${number(rows.length)} 条记录 · 每页 ${PAGE_SIZE} 条 · 第 ${page + 1} / ${totalPages} 页`;
  $("history-empty").hidden = !!rows.length;
  $("history-prev").disabled = page === 0;
  $("history-next").disabled = page + 1 >= totalPages;
}
function renderCollection(account) {
  const selected = $("collection-kind").value;
  const kind = selected === "agents" ? "agent" : "engine", all = aggregates(account, kind);
  $("collection-title").textContent = labels[selected];
  const total = all.reduce((n, r) => n + r.count, 0), counts = { S: 0, A: 0, B: 0, unknown: 0 };
  for (const row of all) for (const rank of Object.keys(counts)) counts[rank] += row.rankCounts[rank];
  const query = $("collection-search").value.trim().toLowerCase(), sort = $("collection-sort").value;
  const rows = all.filter((r) => !query || window.DUKE_I18N.matches([r.name, r.itemId], query));
  rows.sort((a, b) => sort === "name" ? window.DUKE_I18N.t(a.name).localeCompare(window.DUKE_I18N.t(b.name), window.DUKE_I18N.language) : sort === "recent" ? b.last.localeCompare(a.last) : sort === "count" ? b.count - a.count || window.DUKE_I18N.t(a.name).localeCompare(window.DUKE_I18N.t(b.name), window.DUKE_I18N.language) : ({ S: 0, A: 1, B: 2 }[a.rank] ?? 3) - ({ S: 0, A: 1, B: 2 }[b.rank] ?? 3) || b.count - a.count);
  $("collection-grid").replaceChildren(...rows.slice(0, collectionLimit).map((r) => {
    const card = el2("article", "collection-card"), info = el2("div", "collection-info");
    info.append(el2("h3", "", r.name), badge(r.rank), el2("p", "", [...r.pools].map((p) => labels[p] || `其他池 ${p}`).join(" · ")), el2("small", "", `最近获取 ${r.last.slice(0, 10)}`));
    if (kind === "agent" && metadata(r)?.id) {
      const link = el2("a", "collection-agent-link", "查看角色资料 ↗");
      link.href = `agents.html#agent=${metadata(r).id}`;
      info.append(link);
    }
    card.append(avatar(r), info, el2("strong", "collection-count", `×${number(r.count)}`));
    return card;
  }));
  if (!rows.length) $("collection-grid").append(el2("p", "collection-empty", query ? "没有找到匹配的记录。" : `还没有可识别的${kind === "agent" ? "代理人" : "音擎"}记录。请导入带 item_id 或 item_type 的文件。`));
  $("collection-more").hidden = rows.length <= collectionLimit;
  $("collection-more").textContent = `继续查看 · 已展示 ${Math.min(rows.length, collectionLimit)} / ${rows.length} 种`;
  const unclassified = account.records.filter((r) => itemType(r) === "unknown").length;
  $("collection-note").textContent = `已导入 ${number(all.length)} 种，共 ${number(total)} 次（S ${number(counts.S)} / A ${number(counts.A)} / B ${number(counts.B)}）。仅汇总调频所得。${unclassified ? ` 有 ${number(unclassified)} 条物品类型暂未识别，未计入总览。` : ""}`;
}
function renderRating(account) {
  const rating = rateLuck(account, { poolId: selectedTab });
  const result = el2("div", "luck-result"), grade = el2("strong", "luck-grade", rating.grade || "—");
  grade.dataset.grade = rating.grade || "pending";
  result.append(el2("span", "luck-kicker", "本站娱乐评级"), grade, el2("h3", "luck-title", rating.title), el2("span", "luck-sample", rating.sampleCount ? `${rating.sampleCount} 个有效区间${rating.provisional ? " · 样本较少，暂定评级" : ""}` : "等待更多记录"));
  const details = el2("div", "luck-details"), reasons = el2("ul", "luck-reasons");
  details.append(el2("h3", "", "为什么是这个评级？"));
  for (const reason of rating.reasons.slice(0, 3)) reasons.append(el2("li", "", reason));
  details.append(reasons);
  const basis = el2("details", "luck-basis");
  basis.append(el2("summary", "", "查看六档判断依据与样本说明"));
  if (rating.reasons.length > 3) {
    const rest = el2("ul", "luck-reasons");
    for (const reason of rating.reasons.slice(3)) rest.append(el2("li", "", reason));
    basis.append(rest);
  }
  const table = el2("table", "luck-bands"), head = el2("thead"), headRow = el2("tr");
  for (const label of ["评级", "中文称号", "判断区间"]) {
    const cell = el2("th", "", label);
    cell.scope = "col";
    headRow.append(cell);
  }
  head.append(headRow);
  table.append(head);
  const body = el2("tbody");
  for (const band of rating.bands) {
    const row = el2("tr");
    if (band.grade === rating.grade) row.dataset.current = "true";
    row.append(el2("td", "", band.grade), el2("td", "", band.title), el2("td", "", band.description));
    body.append(row);
  }
  table.append(body);
  basis.append(table);
  details.append(basis, el2("p", "luck-note", rating.note));
  $("luck-panel").replaceChildren(result, details);
}
function render() {
  const account = active();
  tuningWorkspace?.sync({ account });
  $("demo-banner").hidden = !demo;
  $("demo-exit").hidden = !demo;
  $("account-controls").hidden = !account;
  $("account-select").replaceChildren(...activeAccounts().map((a) => {
    const option = el2("option", "", demo ? "示例账号 · 虚构记录" : `UID ${a.uid} · ${number(a.records.length)} 抽`);
    option.value = a.uid;
    return option;
  }));
  if (account) {
    selectedUid = account.uid;
    $("account-select").value = account.uid;
  }
  for (const id of ["export-json", "export-csv", "export-uigf", "timezone-open", "clear-account", "account-select"]) $(id).disabled = !account || busy || !!demo && ["clear-account", "timezone-open"].includes(id);
  $("import-open").disabled = busy;
  $("demo-open").disabled = busy;
  $("import-file").disabled = busy;
  if ($("rng-import-open")) $("rng-import-open").disabled = busy;
  if ($("link-open")) $("link-open").disabled = busy;
  stats = account ? analyzeAccount2(account) : null;
  updateRecordView();
  if (!account) {
    renderGuaranteeHub(null);
    void renderUpPairs(null, { catalog, avatar });
    for (const id of ["history-body", "collection-grid", "luck-panel"]) $(id).replaceChildren();
    return;
  }
  renderOpenTools();
}
function renderOpenTools(opened = null) {
  const account = active();
  if (!account) return;
  for (const [id, renderTool] of [
    ["guarantee-hub", renderGuaranteeHub],
    ["up-pair-panel", (account2) => renderUpPairs(account2, { catalog, avatar })],
    ["collection-panel", renderCollection],
    ["luck-panel", renderRating]
  ]) {
    const panel = $(id);
    if (panel && (!opened || opened.contains(panel)) && !panel.closest("details:not([open])")) renderTool(account);
  }
}
function updateRecordView() {
  const account = active() || null;
  const scope = demo ? "demo" : account ? "account:" + account.uid : "manual";
  const region = demo ? "prod_gf_cn" : account ? checkpoints[account.uid]?.region : null;
  function showChannel(id) {
    const changed = selectedTab !== id, switched = recordScope !== scope;
    if (switched) {
      recordScope = scope;
      collectionLimit = 48;
      $("collection-search").value = "";
    }
    if (changed || switched) {
      selectedTab = id;
      page = 0;
      $("record-search").value = "";
      $("rank-filter").value = "all";
    }
    recordWalletView?.update(id, scope);
    if (account) {
      renderHistory(account);
      if (changed && !$("luck-panel").closest("details:not([open])")) renderRating(account);
    }
  }
  recordView?.render({
    account,
    analysis: stats,
    catalog,
    banners,
    calendar,
    region,
    versionStarts,
    avatar,
    itemName,
    demo: !!demo,
    onShare: openTuningRecordShare,
    onChannelChange: showChannel
  });
}
async function acceptRecords(incoming, { linkCheckpoint, expectedRevision, expectedAccounts } = {}) {
  const result = await updateAccounts((current) => ({ ...mergeAccounts(current, incoming.accounts), ...linkCheckpoint ? { linkCheckpoint } : {} }), { expectedRevision, expectedAccounts, includeSync: true });
  setArchive(result);
  demo = null;
  selectedUid = incoming.accounts[0]?.uid || selectedUid;
  page = 0;
  channel?.postMessage("changed");
  const warnings = [.../* @__PURE__ */ new Set([...incoming.warnings, ...result.warnings])];
  announce(`已导入：新增 ${number(result.added)} 条，重复 ${number(result.duplicates)} 条。${persistent ? "记录已保存在此浏览器。" : "此浏览器无法保存记录，当前仅临时显示，请及时导出完整备份。"}${warnings.length ? ` ${warnings.join(" ")}` : ""}`, warnings.length || !persistent ? "warning" : "success");
  try {
    if (new URL(location.href).searchParams.has("demo")) {
      const url = new URL(location.href);
      url.searchParams.delete("demo");
      history.replaceState(null, "", url);
    }
  } catch {
  }
  return { ...result, persistent };
}
async function importFile(file) {
  if (busy || !file) return;
  busy = true;
  render();
  announce(`正在读取 ${file.name}…`);
  try {
    if (file.size > IMPORT_LIMITS.bytes) throw new Error("文件超过 20 MB，请拆分后导入。");
    const text3 = await file.text();
    let data = null;
    if (text3.replace(/^\uFEFF/, "").trimStart().startsWith("{")) {
      try {
        data = JSON.parse(text3.replace(/^\uFEFF/, ""));
      } catch {
      }
    }
    if (isRngBackup(data)) {
      const snapshot = await readImportState();
      const incoming = await reviewRngMigration(text3, file.name, snapshot, catalog);
      if (incoming) await acceptRecords(incoming, { expectedRevision: snapshot.revision, expectedAccounts: snapshot.accounts });
      else announce("已取消迁入，本地档案保持不变。");
    } else await acceptRecords(parseImport(text3, file.name));
  } catch (error) {
    announce(`导入未完成：${error.message} 原有记录已保留。`, "error");
  } finally {
    $("import-file").value = "";
    finishUpdate();
  }
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = el2("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3e4);
}
function safeFilename(uid) {
  return String(uid).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}
function exportFile(kind) {
  const account = active();
  if (!account) return;
  try {
    const prefix = demo ? "示例-" : "", date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (kind === "csv") download(exportCSV(account), `${prefix}调频记录-${safeFilename(account.uid)}-${date}.csv`, "text/csv;charset=utf-8");
    else download(JSON.stringify(kind === "uigf" ? exportUIGF(activeAccounts()) : exportBackup(activeAccounts())), `${prefix}${kind === "uigf" ? "UIGF" : "DUKE 调频完整备份"}-${date}.json`, "application/json;charset=utf-8");
    announce(kind === "csv" ? "已导出所选账号 CSV。建议同时保存完整备份，避免表格软件改写长数字 ID。" : `已导出${demo ? "示例记录" : "所有本地账号"}${kind === "uigf" ? "的 UIGF 文件" : "的完整备份"}。`, "success");
  } catch (error) {
    announce(error.message, "error");
  }
}
function createDemo() {
  const list = Object.values(catalog), by = (type, rank) => list.filter((i) => i.type === type && i.rank === rank);
  const fallback = {
    agent: { S: { id: "1021", name: "猫又", type: "agent", rank: "S" }, A: { id: "1011", name: "安比", type: "agent", rank: "A" } },
    engine: { S: { id: "14102", name: "钢铁肉垫", type: "engine", rank: "S" }, A: { id: "13101", name: "德玛拉电池Ⅱ型", type: "engine", rank: "A" }, B: { id: "12001", name: "「月相」-朔", type: "engine", rank: "B" } },
    bangboo: { S: { id: "50001", name: "鲨牙布", type: "bangboo", rank: "S" }, A: { id: "50002", name: "纸袋布", type: "bangboo", rank: "A" }, B: { id: "demo-b", name: "邦布调频 B 级物品", type: "material", rank: "B" } }
  };
  const specs = [
    { pool: "2", n: 238, golds: [34, 71, 110, 168, 213], octoberFrom: 86, novemberFrom: 140, sItems: ["1581", "1021", "1641", "1631", "1021"] },
    { pool: "3", n: 156, golds: [28, 63, 103, 144], novemberFrom: 50, sItems: ["14158", "14102", "14163", "14157"] },
    { pool: "1", n: 103, golds: [42, 89] },
    { pool: "5", n: 92, golds: [65] },
    { pool: "102", n: 99, golds: [78], rescreen: true, sItems: ["1481"] },
    { pool: "103", n: 94, golds: [67], rescreen: true, sItems: ["14148"] }
  ];
  const records = [];
  let counter = 0;
  for (const spec of specs) {
    let lastA = 0;
    for (let i = 1; i <= spec.n; i++) {
      const rank = spec.golds.includes(i) ? "S" : i - lastA >= 9 ? "A" : "B";
      if (rank !== "B") lastA = i;
      const type = spec.pool === "5" && rank !== "B" ? "bangboo" : rank === "B" || ["3", "103"].includes(spec.pool) || spec.pool === "1" && i % 2 === 0 && !spec.golds.includes(i) ? "engine" : "agent";
      const candidates = by(type, rank);
      let item = candidates[(i * 7 + counter) % (candidates.length || 1)] || fallback[type]?.[rank] || { id: "demo-material", name: "邦布调频材料（示例）", rank: "B" };
      if (rank === "S" && spec.sItems) item = catalog[spec.sItems[spec.golds.indexOf(i)]] || item;
      let day = Date.UTC(2026, 7, spec.rescreen ? 20 : 1);
      if (i >= spec.octoberFrom) day = Date.UTC(2026, 9, 25);
      if (i >= spec.novemberFrom) day = Date.UTC(2026, 10, 15);
      const time = new Date(day + (600 + i) * 6e4).toISOString().slice(0, 19).replace("T", " ");
      records.push({ uid: "DEMO", id: String(9000000000000000000n + BigInt(++counter)), pool: spec.pool, name: item.name, itemId: item.id, rank, itemType: { agent: "代理人", engine: "音擎", bangboo: "邦布" }[type] || "材料", time });
    }
  }
  return { uid: "DEMO", timezone: 8, lang: "zh-cn", records };
}
function setup() {
  $("import-open").onclick = () => $("import-file").click();
  $("import-file").onchange = () => importFile($("import-file").files[0]);
  $("demo-open").onclick = () => {
    demo = createDemo();
    selectedUid = demo.uid;
    selectedTab = "2";
    page = 0;
    render();
    announce("");
  };
  $("demo-exit").onclick = () => {
    demo = null;
    selectedUid = accounts[0]?.uid || "";
    page = 0;
    render();
    announce("已退出示例，回到你的本地记录。");
  };
  $("account-select").onchange = () => {
    selectedUid = $("account-select").value;
    page = 0;
    render();
  };
  $("export-json").onclick = () => exportFile("backup");
  $("export-csv").onclick = () => exportFile("csv");
  $("export-uigf").onclick = () => exportFile("uigf");
  $("record-search").oninput = $("rank-filter").onchange = () => {
    page = 0;
    renderHistory(active());
  };
  $("collection-search").oninput = $("collection-kind").onchange = $("collection-sort").onchange = () => {
    collectionLimit = 48;
    renderCollection(active());
  };
  $("collection-more").onclick = () => {
    collectionLimit += 48;
    renderCollection(active());
  };
  $("history-prev").onclick = () => {
    page--;
    renderHistory(active());
  };
  $("history-next").onclick = () => {
    page++;
    renderHistory(active());
  };
  $("download-template").onclick = () => download("\uFEFFuid,id,gacha_type,time,rank_type,name,item_id,item_type,timezone,lang\r\n100000001,9000000000000000001,2,2026-08-01 12:00:00,3,安比,1011,代理人,8,zh-cn\r\n", "调频CSV格式示例-请替换为真实记录.csv", "text/csv;charset=utf-8");
  $("clear-account").onclick = async () => {
    const account = active();
    if (!account || demo || busy) return;
    if (!window.confirm(`清除本浏览器中 UID ${account.uid} 的 ${account.records.length} 条记录？请先导出完整备份。其他账号不受影响。`)) return;
    busy = true;
    render();
    try {
      setArchive(await updateAccounts((current) => ({ accounts: current.filter((a) => a.uid !== account.uid) }), { includeSync: true }));
      selectedUid = accounts[0]?.uid || "";
      channel?.postMessage("changed");
      announce("已清除所选账号的本地记录。");
    } catch (error) {
      announce(`清除失败：${error.message}`, "error");
    } finally {
      finishUpdate();
    }
  };
  const unknownZone = el2("option", "", "请选择记录所属时区");
  unknownZone.value = "";
  $("timezone-select").append(unknownZone);
  for (let z = -12; z <= 14; z++) {
    const option = el2("option", "", `UTC${z >= 0 ? "+" : ""}${z}${z === 8 ? "（中国标准时间）" : ""}`);
    option.value = String(z);
    $("timezone-select").append(option);
  }
  $("timezone-open").onclick = () => {
    $("timezone-select").value = active()?.timezone == null ? "" : String(active().timezone);
    $("timezone-dialog").showModal();
  };
  $("timezone-close").onclick = () => $("timezone-dialog").close();
  $("timezone-save").onclick = async () => {
    const account = active();
    const value = $("timezone-select").value;
    if (!account || demo || busy) return;
    if (value === "") {
      $("timezone-select").focus();
      announce("请选择原始记录所属的时区。", "warning");
      return;
    }
    busy = true;
    try {
      setArchive(await updateAccounts((current) => {
        const next = current.map((a) => a.uid === account.uid ? { ...a, timezone: Number(value) } : a);
        exportBackup(next);
        return { accounts: next };
      }, { includeSync: true }));
      channel?.postMessage("changed");
      $("timezone-dialog").close();
      announce("已标注记录所属时区。时间文字保持原样，没有转换时间。");
    } catch (error) {
      announce(`保存时区失败：${error.message}`, "error");
    } finally {
      finishUpdate();
    }
  };
  const zone = $("drop-zone");
  let depth = 0;
  zone.addEventListener("dragenter", (e) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      depth++;
      zone.dataset.dragging = "true";
    }
  });
  zone.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  zone.addEventListener("dragleave", () => {
    if (--depth <= 0) {
      depth = 0;
      delete zone.dataset.dragging;
    }
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    delete zone.dataset.dragging;
    if (e.dataTransfer.files.length !== 1) {
      announce("请一次拖入一个 JSON 或 CSV 文件。", "warning");
      return;
    }
    importFile(e.dataTransfer.files[0]);
  });
  document.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) e.preventDefault();
  });
  document.addEventListener("toggle", (event) => {
    if (event.target.tagName === "DETAILS" && event.target.open) renderOpenTools(event.target);
  }, true);
  channel?.addEventListener("message", syncAccounts);
}
async function initialize() {
  try {
    announce("正在加载调频工具…");
    const results = await Promise.allSettled([openStorage({ includeSync: true }), fetchTuningJSON("tuning-catalog.json?v=20261118-reviewed-ui-launch-1"), loadBannerData()]);
    if (results[0].status === "fulfilled") setArchive(results[0].value);
    if (results[1].status === "fulfilled") {
      catalog = results[1].value.items || {};
      for (const item of Object.values(catalog)) {
        if (item.name) names.set(item.name, item);
        for (const alias of item.aliases || []) if (!names.has(alias)) names.set(alias, item);
      }
    } else catalogError = true;
    if (results[2].status === "fulfilled") banners = results[2].value;
    if (!$("collection-note")) {
      const note = el2("p", "collection-note");
      note.id = "collection-note";
      $("collection-panel").append(note);
    }
    const more = el2("button", "secondary-button");
    more.id = "collection-more";
    more.type = "button";
    more.hidden = true;
    $("collection-note").before(more);
    mountExpectation();
    mountUpPairs();
    mountRngMigration({ chooseFile: () => $("import-file").click() });
    setup();
    setupLinkImport({ getImportState: readImportState, onRecords: (data, options) => acceptRecords(parseImport(JSON.stringify(data), "official-history.json"), { ...options, linkCheckpoint: data.linkCheckpoint }), onBusy: (value) => {
      if (value) {
        busy = true;
        render();
      } else finishUpdate();
    }, onMessage: announce });
    tuningWorkspace = mountTuningWorkspace();
    recordView = mountTuningRecords($("tuning-signal-stats"));
    recordWalletView = mountRecordWallet($("tuning-records-wallet"));
    render();
    void fetchTuningJSON("banner-calendar.json?v=20261126-creator-events-launch-1").then((value) => {
      calendar = value;
      updateRecordView();
    }).catch(() => {
    });
    const notices = [];
    if (!persistent) notices.push("浏览器本地存储不可用。可以临时分析，但离开前请导出完整备份。");
    if (catalogError) notices.push("图标目录暂未加载，仍可导入记录和查看基础统计。");
    if (results[2].status === "rejected") notices.push("卡池资料暂未加载，大小保底与 UP 身份暂无法核实；可以先查看基础统计，网络恢复后刷新重试。");
    announce(notices.join(" ") || "记录仅保存在本浏览器。可以导入文件，或先体验示例。", notices.length ? "warning" : "info");
    window.tuningAnalysis = { getState: () => ({ ready: true, demo: !!demo, uid: active()?.uid, tab: selectedTab, persistent, total: active()?.records.length || 0, accountCount: accounts.length, stats: stats ? cloneData(stats) : null, catalogCount: Object.keys(catalog).length }) };
    if (new URL(location.href).searchParams.get("demo") === "1") $("demo-open").click();
    tuningWorkspace.applyLocation();
  } catch (error) {
    announce(`页面初始化失败：${error.message}。请刷新重试。`, "error");
  }
}
void initialize();

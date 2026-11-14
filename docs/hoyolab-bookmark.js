// Runs only after the visitor explicitly invokes their bookmark on the official page.
// Cookies stay in that browser's official origin and are never read by this script.
export function runHoyolabBookmark(target) {
  const officialOrigin = 'https://act.hoyolab.com';
  const channel = 'duke-hoyolab-sync-v1';
  const allowedOrigins = ['https://dukezzz.com', 'https://www.dukezzz.com', 'http://127.0.0.1:8877', 'http://localhost:8877'];
  const githubBase = 'https://dotty77.github.io/dukezzz-pages-test/';
  const targetBase = target === githubBase ? githubBase : allowedOrigins.includes(target) ? target + '/' : allowedOrigins.some(origin => target === origin + '/') ? target : '';
  if (!targetBase) return;
  const targetOrigin = new URL(targetBase).origin;
  if (location.origin !== officialOrigin || !/^\/(zzz\/gt\/character-builder-h\/|app\/zzz-game-record\/)/.test(location.pathname)) {
    alert('请先打开并登录 HoYoLAB 绝区零养成指南，再点击此书签。\nOpen and sign in to the official HoYoLAB ZZZ Upgrade Guides, then use this bookmark.');
    return;
  }
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const previous = window.__dukeEquipmentBridge;
  let preferred = null;
  if (typeof previous === 'function') {
    try { if (previous.targetBase === targetBase) preferred = previous.receiver?.(); } catch { /* A closed receiver is not reusable. */ }
    previous();
  }
  if (!preferred || preferred.closed) preferred = window.opener;
  let popup = preferred && !preferred.closed ? preferred : null;
  let stopped = false, busy = false, accounts = [], handshakeId = '', handshakeError = '', idleTimer = 0, pollTimer = 0, offerTimer = 0, fallbackButton = null, controller = null;
  function openPlanner() {
    if (stopped) return;
    clearTimeout(offerTimer); offerTimer = 0;
    const plannerUrl = new URL('disc-planner.html', targetBase);
    plannerUrl.searchParams.set('v', '20261114-direct-tools-1'); plannerUrl.hash = 'hoyolab-sync=' + nonce;
    popup = window.open(plannerUrl.href, '_blank');
    if (popup) { fallbackButton?.remove(); fallbackButton = null; return; }
    // A browser may block the delayed fallback. A real click restores user activation.
    if (!fallbackButton) {
      fallbackButton = document.createElement('button'); fallbackButton.type = 'button';
      fallbackButton.textContent = targetBase === githubBase ? '打开 DUKE GitHub 连接页 / Open DUKE GitHub' : '打开 DUKE 连接页 / Open DUKE';
      fallbackButton.style.cssText = 'position:fixed;right:24px;top:24px;z-index:2147483647;padding:14px 20px;background:#6579ff;color:white;border:1px solid white;border-radius:10px;font:16px sans-serif;cursor:pointer';
      fallbackButton.onclick = openPlanner; (document.body || document.documentElement).append(fallbackButton);
      alert('无法返回原规划器，请点击官方页面右上角“打开 DUKE 连接页”。\nClick “Open DUKE” at the top right of this official page to open the planner.');
    }
  }
  const rosters = new Map();
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const validRequestId = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x);
  const identifier = x => (typeof x === 'string' || typeof x === 'number') && /^[1-9]\d{0,9}$/.test(String(x)) ? x : invalid();
  const numeric = x => typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && /^\d{1,9}$/.test(x) ? x : invalid();
  function invalid() { const error = Error('official_data'); error.code = 'official_data'; throw error; }
  function send(type, fields = {}) { if (!stopped && popup && !popup.closed) popup.postMessage({channel, nonce, targetBase, type, ...fields}, targetOrigin); }
  function touch() { clearTimeout(idleTimer); idleTimer = setTimeout(stop, 600000); }
  function stop() {
    if (stopped) return;
    send('disconnected'); stopped = true;
    clearTimeout(idleTimer); clearTimeout(offerTimer); clearInterval(pollTimer); controller?.abort();
    fallbackButton?.remove(); fallbackButton = null;
    window.removeEventListener('message', receive); window.removeEventListener('pagehide', stop);
    accounts = []; rosters.clear();
    if (window.__dukeEquipmentBridge === stop) delete window.__dukeEquipmentBridge;
  }
  function errorCode(error) {
    const accepted = ['login_required', 'verification_required', 'data_private', 'no_os_account', 'account_not_bound', 'agent_not_owned', 'official_data', 'official_unavailable', 'rate_limit'];
    return accepted.includes(error?.code) ? error.code : 'official_unavailable';
  }
  async function request(url) {
    const abort = new AbortController(); controller = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(url, {credentials:'include', redirect:'error', signal:abort.signal, headers:{'x-rpc-language':'en-us'}});
      if (!response.ok || Number(response.headers.get('content-length')) > 2000000) invalid();
      const reader = response.body.getReader(); let size = 0, chunks = [];
      while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > 2000000) { await reader.cancel(); invalid(); } chunks.push(value); }
      const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
      const result = JSON.parse(new TextDecoder().decode(bytes));
      if (!object(result) || !Number.isInteger(result.retcode)) invalid();
      if (result.retcode !== 0) {
        const error = Error('official');
        error.code = [-100,10001,-101,10101].includes(result.retcode) ? 'login_required'
          : [10035,5003,10041,1034,-3101,-3102].includes(result.retcode) ? 'verification_required'
          : [10102,10104].includes(result.retcode) ? 'data_private' : 'official_unavailable';
        throw error;
      }
      return result.data;
    } finally { clearTimeout(timeout); if (controller === abort) controller = null; }
  }
  function safeAccounts(data) {
    if (!object(data) || !Array.isArray(data.list) || data.list.length > 100) invalid();
    return data.list.filter(a => object(a) && a.game_biz === 'nap_global' && ['prod_gf_us','prod_gf_eu','prod_gf_jp','prod_gf_sg'].includes(a.region)).slice(0,10).map(a => ({uid:String(identifier(a.game_uid)), region:a.region, nickname:typeof a.nickname === 'string' ? a.nickname.slice(0,60) : String(a.game_uid)}));
  }
  function safeAgent(raw) {
    if (!object(raw) || !Array.isArray(raw.equip) || raw.equip.length > 6) invalid();
    const properties = list => {
      if (!Array.isArray(list) || list.length > 10) invalid();
      return list.map(p => { if (!object(p) || typeof p.base !== 'string' || p.base.length > 32) invalid(); return {property_id:identifier(p.property_id), base:p.base}; });
    };
    return {id:identifier(raw.id), rank:numeric(raw.rank), level:numeric(raw.level), weapon:raw.weapon ? {id:identifier(raw.weapon.id), level:numeric(raw.weapon.level), star:numeric(raw.weapon.star)} : null,
      equip:raw.equip.map(d => { if (!object(d) || !object(d.equip_suit) || !['S','A','B'].includes(d.rarity)) invalid(); return {id:identifier(d.id), level:numeric(d.level), rarity:d.rarity, equipment_type:numeric(d.equipment_type), equip_suit:{suit_id:identifier(d.equip_suit.suit_id)}, main_properties:properties(d.main_properties), properties:properties(d.properties)}; })};
  }
  function recordUrl(path, account, agentId) {
    const url = new URL(`https://sg-act-public-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/${path}`);
    url.searchParams.set('role_id', account.uid); url.searchParams.set('server', account.region);
    if (agentId) url.searchParams.append('id_list[]', agentId);
    return url.href;
  }
  async function receive(event) {
    const message = event.data;
    if (stopped || event.origin !== targetOrigin || event.source !== popup || !object(message) || message.channel !== channel || message.nonce !== nonce || message.targetBase !== targetBase) return;
    if (message.type === 'disconnect') { stop(); return; }
    if (!['ready','agents','equipment'].includes(message.type) || !validRequestId(message.requestId)) return;
    const {type, requestId} = message; touch();
    if (type === 'ready') {
      clearTimeout(offerTimer); offerTimer = 0;
      fallbackButton?.remove(); fallbackButton = null;
      try { popup.focus(); } catch { /* Focusing an existing tab is best effort. */ }
      send('connected', {requestId});
      if (requestId === handshakeId) { if (accounts.length) send('accounts', {requestId, accounts}); else if (handshakeError) send('error', {requestId, code:handshakeError}); return; }
    }
    if (busy) { send('error', {requestId, code:'rate_limit'}); return; }
    busy = true;
    try {
      if (type === 'ready') {
        handshakeId = requestId; handshakeError = ''; accounts = []; rosters.clear();
        accounts = safeAccounts(await request('https://sg-public-api.hoyolab.com/binding/api/getUserGameRolesByCookieToken?game_biz=nap_global'));
        if (!accounts.length) { const e = Error('account'); e.code = 'no_os_account'; throw e; }
        send('accounts', {requestId, accounts});
      } else {
        const account = accounts.find(a => a.uid === message.uid);
        if (!account) { const e = Error('account'); e.code = 'account_not_bound'; throw e; }
        if (type === 'agents') {
          const data = await request(recordUrl('basic', account));
          if (!object(data) || !Array.isArray(data.avatar_list) || data.avatar_list.length > 200) invalid();
          const agents = data.avatar_list.map(a => { if (!object(a)) invalid(); const name = [a.name_mi18n,a.full_name_mi18n,a.name].find(value => typeof value === 'string' && value.trim()); return {id:String(identifier(a.id)), name:name ? name.slice(0,100) : String(a.id)}; });
          rosters.set(account.uid, new Set(agents.map(a => a.id)));
          send('agents', {requestId, uid:account.uid, agents});
        } else {
          if (typeof message.agentId !== 'string' || !rosters.get(account.uid)?.has(message.agentId)) { const e = Error('agent'); e.code = 'agent_not_owned'; throw e; }
          const data = await request(recordUrl('info', account, message.agentId));
          if (!object(data) || !Array.isArray(data.avatar_list) || data.avatar_list.length !== 1 || String(data.avatar_list[0]?.id) !== message.agentId) invalid();
          send('equipment', {requestId, uid:account.uid, agentId:message.agentId, agent:safeAgent(data.avatar_list[0])});
        }
      }
    } catch (error) { const code = errorCode(error); if (type === 'ready') handshakeError = code; send('error', {requestId, code}); }
    finally { busy = false; }
  }
  stop.receiver = () => popup;
  stop.targetBase = targetBase;
  window.__dukeEquipmentBridge = stop;
  window.addEventListener('message', receive); window.addEventListener('pagehide', stop);
  pollTimer = setInterval(() => { if (popup && popup.closed) stop(); }, 1000); touch();
  if (popup) {
    send('offer');
    offerTimer = setTimeout(openPlanner, 700);
  } else openPlanner();
}

export function createHoyolabBookmark(target) {
  const origins = ['https://dukezzz.com', 'https://www.dukezzz.com', 'http://127.0.0.1:8877', 'http://localhost:8877'];
  if (target !== 'https://dotty77.github.io/dukezzz-pages-test/' && !origins.includes(target) && !origins.some(origin => target === origin + '/')) throw Error('Unsupported planner destination');
  return `javascript:void (${encodeURIComponent(runHoyolabBookmark.toString())})(${encodeURIComponent(JSON.stringify(target))})`;
}

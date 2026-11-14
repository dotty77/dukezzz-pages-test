// Runs only after the visitor explicitly invokes their bookmark on the official page.
// Cookies stay in that browser's official origin and are never read by this script.
export function runMiyousheBookmark(targetOrigin) {
  const officialOrigin = 'https://act.mihoyo.com';
  const channel = 'duke-miyoushe-web-sync-v1';
  const allowedOrigins = ['https://dukezzz.com', 'https://www.dukezzz.com', 'http://127.0.0.1:8877', 'http://localhost:8877'];
  if (!allowedOrigins.includes(targetOrigin)) return;
  if (location.origin !== officialOrigin || !/^\/zzz\/gt\/character-builder-h\//.test(location.pathname)) {
    alert('请先打开并登录 米游社绝区零养成指南，再点击此书签。\nOpen and sign in to the official Miyoushe ZZZ Upgrade Guides, then use this bookmark.');
    return;
  }
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const previous = window.__dukeMiyousheEquipmentBridge;
  let preferred = null;
  if (typeof previous === 'function') {
    try { preferred = previous.receiver?.(); } catch { /* A closed receiver is not reusable. */ }
    previous();
  }
  if (!preferred || preferred.closed) preferred = window.opener;
  let popup = preferred && !preferred.closed ? preferred : null;
  let stopped = false, busy = false, accounts = [], handshakeId = '', handshakeError = '', handshakeDetails = {}, idleTimer = 0, pollTimer = 0, offerTimer = 0, fallbackButton = null, controller = null;
  function openPlanner() {
    if (stopped) return;
    clearTimeout(offerTimer); offerTimer = 0;
    popup = window.open(`${targetOrigin}/disc-planner.html?v=20261114-refresh-launch-1#miyoushe-sync=${nonce}`, '_blank');
    if (popup) { fallbackButton?.remove(); fallbackButton = null; return; }
    // A browser may block the delayed fallback. A real click restores user activation.
    if (!fallbackButton) {
      fallbackButton = document.createElement('button'); fallbackButton.type = 'button';
      fallbackButton.textContent = '打开 DUKE 连接页 / Open DUKE';
      fallbackButton.style.cssText = 'position:fixed;right:24px;top:24px;z-index:2147483647;padding:14px 20px;background:#6579ff;color:white;border:1px solid white;border-radius:10px;font:16px sans-serif;cursor:pointer';
      fallbackButton.onclick = openPlanner; (document.body || document.documentElement).append(fallbackButton);
      alert('无法返回原规划器，请点击官方页面右上角“打开 DUKE 连接页”。\nClick “Open DUKE” at the top right of this official page to open the planner.');
    }
  }
  const rosters = new Map();
  let builderRequire = null;
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const validRequestId = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x);
  const identifier = x => (typeof x === 'string' || typeof x === 'number') && /^[1-9]\d{0,9}$/.test(String(x)) ? x : invalid();
  const numeric = x => typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && /^\d{1,9}$/.test(x) ? x : invalid();
  class OfficialError extends Error { constructor(code) { super(code); this.code = code; } }
  function invalid() { throw new OfficialError('official_data'); }
  function send(type, fields = {}) { if (!stopped && popup && !popup.closed) popup.postMessage({channel, protocol:2, nonce, type, ...fields}, targetOrigin); }
  function touch() { clearTimeout(idleTimer); idleTimer = setTimeout(stop, 600000); }
  function stop() {
    if (stopped) return;
    send('disconnected'); stopped = true;
    clearTimeout(idleTimer); clearTimeout(offerTimer); clearInterval(pollTimer); controller?.abort();
    fallbackButton?.remove(); fallbackButton = null;
    window.removeEventListener('message', receive); window.removeEventListener('pagehide', stop);
    accounts = []; rosters.clear(); builderRequire = null;
    if (window.__dukeMiyousheEquipmentBridge === stop) delete window.__dukeMiyousheEquipmentBridge;
  }
  function errorCode(error) {
    const accepted = ['login_required', 'verification_required', 'data_private', 'no_cn_account', 'account_not_bound', 'agent_not_owned', 'official_data', 'official_unavailable', 'official_page_changed', 'rate_limit'];
    return accepted.includes(error?.code) ? error.code : 'official_unavailable';
  }
  function diagnosticFields(error) {
    const code = errorCode(error), fields = {code};
    if (!['list_accounts','list_agents','read_equipment'].includes(error?.stage)) return fields;
    fields.stage = error.stage;
    if (Number.isInteger(error.officialCode) && ((code === 'verification_required' && [10035,5003,10041,1034,-3101,-3102].includes(error.officialCode)) || (code === 'rate_limit' && error.officialCode === 10101))) fields.officialCode = error.officialCode;
    return fields;
  }
  async function request(url, stage) {
    const abort = new AbortController(); controller = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(url, {credentials:'include', redirect:'error', signal:abort.signal, headers:{'x-rpc-language':'zh-cn'}});
      if (response.status === 429) throw new OfficialError('rate_limit');
      if (!response.ok || Number(response.headers.get('content-length')) > 2000000) invalid();
      const reader = response.body.getReader(); let size = 0, chunks = [];
      while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > 2000000) { await reader.cancel(); invalid(); } chunks.push(value); }
      const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
      const result = JSON.parse(new TextDecoder().decode(bytes));
      if (!object(result) || !Number.isInteger(result.retcode)) invalid();
      if (result.retcode !== 0) {
        const error = new OfficialError('official_unavailable');
        error.code = result.retcode === 10101 ? 'rate_limit' : [-100,10001,-101].includes(result.retcode) ? 'login_required'
          : [10035,5003,10041,1034,-3101,-3102].includes(result.retcode) ? 'verification_required'
          : [10102,10104].includes(result.retcode) ? 'data_private' : 'official_unavailable';
        if ([10035,5003,10041,1034,-3101,-3102,10101].includes(result.retcode)) error.officialCode = result.retcode;
        throw error;
      }
      return result.data;
    } catch (error) {
      const safe = error instanceof OfficialError ? error : new OfficialError('official_unavailable');
      if (['list_accounts','list_agents','read_equipment'].includes(stage)) safe.stage = stage;
      throw safe;
    } finally { clearTimeout(timeout); if (controller === abort) controller = null; }
  }
  function safeAccounts(data) {
    if (!object(data) || !Array.isArray(data.list) || data.list.length > 100) invalid();
    return data.list.filter(a => object(a) && a.game_biz === 'nap_cn' && ['prod_gf_cn','prod_qd_cn'].includes(a.region)).slice(0,10).map(a => ({uid:/^[1-9]\d{5,9}$/.test(String(a.game_uid)) ? String(identifier(a.game_uid)) : invalid(), region:a.region, nickname:typeof a.nickname === 'string' ? a.nickname.slice(0,60) : String(a.game_uid)}));
  }
  function safeAgent(raw) {
    if (!object(raw) || !Array.isArray(raw.equip) || raw.equip.length > 6) invalid();
    if (raw.weapon != null && !object(raw.weapon)) invalid();
    const properties = list => {
      if (!Array.isArray(list) || list.length > 10) invalid();
      return list.map(p => { if (!object(p) || typeof p.base !== 'string' || p.base.length > 32) invalid(); return {property_id:identifier(p.property_id), base:p.base}; });
    };
    return {id:identifier(raw.id), rank:numeric(raw.rank), level:numeric(raw.level), weapon:raw.weapon != null ? {id:identifier(raw.weapon.id), level:numeric(raw.weapon.level), star:numeric(raw.weapon.star)} : null,
      equip:raw.equip.map(d => { if (!object(d) || !object(d.equip_suit) || !['S','A','B'].includes(d.rarity)) invalid(); return {id:identifier(d.id), level:numeric(d.level), rarity:d.rarity, equipment_type:numeric(d.equipment_type), equip_suit:{suit_id:identifier(d.equip_suit.suit_id)}, main_properties:properties(d.main_properties), properties:properties(d.properties)}; })};
  }
  function builderClient() {
    function changed() { throw new OfficialError('official_page_changed'); }
    try {
      const script = 'https://act.mihoyo.com/zzz/gt/character-builder-h/static/js/index.b32bce78.js';
      if (!Array.from(document.scripts || []).some(s => s.src === script)) changed();
      const chunks = window.webpackChunkcharacter_builder_h;
      if (!Array.isArray(chunks) || typeof chunks.push !== 'function') changed();
      // The official loader runs a chunk callback only once per ID. Keep its accessor
      // for this bridge, while validating the module and initialized client on every read.
      if (!builderRequire) chunks.push([['duke-builder-read-' + nonce], {}, r => { builderRequire = r; }]);
      const require = builderRequire;
      if (typeof require !== 'function' || typeof require.m?.[39584] !== 'function') changed();
      const api = require(39584);
      if (!api || !['Hx','un','HD'].every(key => typeof api[key] === 'function')) changed();
      const client = api.Hx(), handlers = client?.interceptors?.request?.handlers;
      if (typeof client?.request !== 'function' || client.defaults?.baseURL !== 'https://act-api-takumi.mihoyo.com/event/nap_cultivate_tool/user' || client.defaults?.withCredentials !== true || !Array.isArray(handlers) || handlers.length !== 4 || handlers.filter(h => typeof h?.fulfilled === 'function').length !== 3 || handlers.filter(h => typeof h?.rejected === 'function').length !== 1) changed();
      return client;
    } catch (error) { throw error instanceof OfficialError ? error : new OfficialError('official_page_changed'); }
  }
  async function builderRequest(account, agentId) {
    const stage = agentId ? 'read_equipment' : 'list_agents';
    const abort = new AbortController(); controller = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const client = builderClient();
      const config = {url:agentId ? '/batch_avatar_detail_v2' : '/avatar_basic_list', method:agentId ? 'post' : 'get', params:{uid:account.uid, region:account.region}, signal:abort.signal, timeout:15000};
      if (agentId) config.data = {avatar_list:[{avatar_id:Number(agentId), is_teaser:false, teaser_need_weapon:false, teaser_sp_skill:false}]};
      // Use the already-configured official client; never inspect or copy its auth/device headers.
      // Axios parses the response first. This bound limits accepted data, not network transfer/allocation.
      const response = await client.request(config), result = response?.data;
      if (response?.status === 429) throw new OfficialError('rate_limit');
      if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300 || !object(result) || new TextEncoder().encode(JSON.stringify(result)).length > 2000000 || !Number.isInteger(result.retcode)) invalid();
      if (result.retcode !== 0) {
        const error = new OfficialError(result.retcode === 10101 ? 'rate_limit' : [-100,10001,-101].includes(result.retcode) ? 'login_required' : [10035,5003,10041,1034,-3101,-3102].includes(result.retcode) ? 'verification_required' : [10102,10104].includes(result.retcode) ? 'data_private' : 'official_unavailable');
        if ([10035,5003,10041,1034,-3101,-3102,10101].includes(result.retcode)) error.officialCode = result.retcode;
        throw error;
      }
      return result.data;
    } catch (error) {
      const safe = error instanceof OfficialError ? error : new OfficialError(error?.response?.status === 429 ? 'rate_limit' : 'official_unavailable');
      safe.stage = stage; throw safe;
    } finally { clearTimeout(timeout); if (controller === abort) controller = null; }
  }
  async function receive(event) {
    const message = event.data;
    if (stopped || event.origin !== targetOrigin || event.source !== popup || !object(message) || message.channel !== channel || message.nonce !== nonce) return;
    if (message.type === 'disconnect') { stop(); return; }
    if (!['ready','agents','equipment'].includes(message.type) || !validRequestId(message.requestId)) return;
    const {type, requestId} = message; touch();
    if (type === 'ready') {
      clearTimeout(offerTimer); offerTimer = 0;
      fallbackButton?.remove(); fallbackButton = null;
      try { popup.focus(); } catch { /* Focusing an existing tab is best effort. */ }
      send('connected', {requestId});
      if (requestId === handshakeId) { if (accounts.length) send('accounts', {requestId, accounts}); else if (handshakeError) send('error', {requestId, code:handshakeError, ...handshakeDetails}); return; }
    }
    if (busy) { send('error', {requestId, code:'rate_limit'}); return; }
    busy = true;
    try {
      if (type === 'ready') {
        handshakeId = requestId; handshakeError = ''; handshakeDetails = {}; accounts = []; rosters.clear();
        accounts = safeAccounts(await request('https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookieToken?game_biz=nap_cn', 'list_accounts'));
        if (!accounts.length) { const e = Error('account'); e.code = 'no_cn_account'; throw e; }
        send('accounts', {requestId, accounts});
      } else {
        const account = accounts.find(a => a.uid === message.uid);
        if (!account) { const e = Error('account'); e.code = 'account_not_bound'; throw e; }
        if (type === 'agents') {
          rosters.delete(account.uid);
          const data = await builderRequest(account);
          if (!object(data) || !Array.isArray(data.list) || data.list.length > 200) invalid();
          const agents = data.list.filter(a => object(a) && a.unlocked === true && a.is_teaser === false).map(entry => { const a = entry.avatar; if (!object(a)) invalid(); const name = [a.name_mi18n,a.full_name_mi18n,a.name].find(value => typeof value === 'string' && value.trim()); return {id:String(identifier(a.id)), name:name ? name.slice(0,100) : String(a.id)}; });
          rosters.set(account.uid, new Set(agents.map(a => a.id)));
          send('agents', {requestId, uid:account.uid, agents});
        } else {
          if (typeof message.agentId !== 'string' || !rosters.get(account.uid)?.has(message.agentId)) { const e = Error('agent'); e.code = 'agent_not_owned'; throw e; }
          const data = await builderRequest(account, message.agentId);
          if (!object(data) || !Array.isArray(data.list) || data.list.length !== 1) invalid();
          const detail = data.list[0], avatar = detail?.avatar;
          if (!object(detail) || !object(avatar) || String(avatar.id) !== message.agentId || avatar.unlock !== true || detail.is_teaser === true || avatar.is_teaser === true) invalid();
          send('equipment', {requestId, uid:account.uid, agentId:message.agentId, agent:safeAgent({id:avatar.id,rank:avatar.rank,level:avatar.level,weapon:detail.weapon,equip:detail.equip})});
        }
      }
    } catch (error) {
      const fields = diagnosticFields(error);
      if (type === 'ready') { handshakeError = fields.code; handshakeDetails = fields; }
      send('error', {requestId, ...fields});
    }
    finally { busy = false; }
  }
  stop.receiver = () => popup;
  window.__dukeMiyousheEquipmentBridge = stop;
  window.addEventListener('message', receive); window.addEventListener('pagehide', stop);
  pollTimer = setInterval(() => { if (popup && popup.closed) stop(); }, 1000); touch();
  if (popup) {
    send('offer');
    offerTimer = setTimeout(openPlanner, 700);
  } else openPlanner();
}

export function createMiyousheBookmark(origin) {
  if (!['https://dukezzz.com','https://www.dukezzz.com','http://127.0.0.1:8877','http://localhost:8877'].includes(origin)) throw Error('Unsupported planner origin');
  return `javascript:void (${encodeURIComponent(runMiyousheBookmark.toString())})(${encodeURIComponent(JSON.stringify(origin))})`;
}

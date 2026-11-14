// Searchable agent grid shared by 配队检查 and 养成计算.
export const $ = id => document.getElementById(id);
export const el = (tag, cls = '', text = '') => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== '') node.textContent = text; return node; };
const ELEMENT_COLORS = {物理: '#b59b64', 火: '#d97657', 冰: '#63acbc', 电: '#9578c4', 以太: '#b677a8', 风: '#67ad91', 流明: '#c5a56a'};
export const elementBase = element => String(element || '').split(' / ').pop().replace('属性', '');
export const elementColor = element => ELEMENT_COLORS[elementBase(element)] || '#8791c9';
const ELEMENTS = ['物理', '火', '冰', '电', '以太', '风', '流明'];
const SPECIALTIES = ['强攻', '击破', '异常', '支援', '防护', '命破', '锋御'];

// On narrow screens the page switcher scrolls sideways; keep the current page's tab in view.
for (const nav of document.querySelectorAll('.agent-page-switch')) {
  const current = nav.querySelector('[aria-current="page"]');
  if (current && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
}

export function picture(path, alt = '', cls = '') {
  const image = el('img', cls);
  image.alt = alt; image.decoding = 'async'; image.loading = 'lazy';
  if (/^assets\/[\w/-]+\.(?:webp|png|jpe?g)$/.test(path || '') || (typeof path === 'string' && path.length <= 65536 && /^data:image\/(?:png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(path) && !path.endsWith(','))) image.src = path;
  image.addEventListener('error', () => { image.style.visibility = 'hidden'; }, {once: true});
  return image;
}

// Released client data can be available before the corresponding banner opens.
export function availabilityLabel(entry, english = window.DUKE_I18N?.language === 'en') {
  const availability = entry?.availability;
  if (!availability || availability.status === 'released') return '';
  const date = /^\d{4}-(\d{2})-(\d{2})/.exec(availability.startTime || '');
  if (date) return english ? `Opens ${date[1]}/${date[2]}` : `${date[1]}/${date[2]} 开放`;
  return english ? 'Announced' : '已公布';
}
export function availabilityBadge(entry) {
  const label = availabilityLabel(entry, false);
  if (!label) return null;
  const badge = el('em', 'pill warn', label);
  badge.dataset.i18nEn = availabilityLabel(entry, true);
  return badge;
}

export function toast(message) {
  let node = document.querySelector('.planner-toast');
  if (!node) { node = el('div', 'planner-toast'); node.setAttribute('role', 'status'); document.body.append(node); }
  node.textContent = message; node.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 2200);
}

export async function loadJSON(path) {
  const response = await fetch(path, {cache: 'no-cache'});
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

/**
 * mountPicker(container, {agents, aliases, isSelected, onPick, badge})
 * agents: [{id,name,element,specialty,rank,icon,status}] in display order.
 */
export function mountPicker(container, {agents, aliases = {}, isSelected = () => false, onPick, badge, elements = ELEMENTS, elementLabels = {}}) {
  const state = {query: '', element: '', specialty: ''};
  const search = el('input'); search.type = 'search'; search.placeholder = '搜索代理人'; search.setAttribute('aria-label', '搜索代理人');
  const chips = (values, key, label, labels = {}) => {
    const wrap = el('div', 'picker-chips'); wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', label);
    for (const value of ['', ...values]) {
      const button = el('button', '', value || '全部'); button.type = 'button'; button.dataset.value = value; if (labels[value]) button.dataset.i18nEn = labels[value];
      button.addEventListener('click', () => { state[key] = value; render(); });
      wrap.append(button);
    }
    return wrap;
  };
  const elementChips = chips(elements, 'element', '属性', elementLabels), specialtyChips = chips(SPECIALTIES, 'specialty', '特性');
  const tools = el('div', 'picker-tools'); tools.append(search, elementChips, specialtyChips);
  const grid = el('div', 'picker-grid');
  container.replaceChildren(tools, grid);
  search.addEventListener('input', () => { state.query = search.value.trim(); render(); });

  function render() {
    for (const [wrap, key] of [[elementChips, 'element'], [specialtyChips, 'specialty']])
      for (const button of wrap.children) button.setAttribute('aria-pressed', String(button.dataset.value === state[key]));
    const shown = agents.filter(agent => (!state.element || elementBase(agent.element) === state.element)
      && (!state.specialty || agent.specialty === state.specialty)
      && (!state.query || window.DUKE_I18N?.matches([agent.name, agent.faction, ...(aliases[agent.id] || [])], state.query)));
    if (!shown.length) { grid.replaceChildren(el('p', 'planner-empty', '没有符合条件的代理人')); return; }
    grid.replaceChildren(...shown.map(agent => {
      const card = el('button', 'picker-card'); card.type = 'button';
      card.setAttribute('aria-pressed', String(isSelected(agent.id)));
      const meta = el('small'); const dot = el('i', 'element-dot'); dot.style.background = elementColor(agent.element);
      meta.append(dot, el('span', '', agent.specialty));
      card.append(picture(agent.icon, ''), el('span', '', agent.name), meta);
      if (agent.status === 'beta') card.append(el('em', 'pill warn', '测试服'));
      const opening = availabilityBadge(agent); if (opening) card.append(opening);
      const extra = badge?.(agent); if (extra) card.append(extra);
      card.addEventListener('click', () => onPick(agent));
      return card;
    }));
  }
  render();
  return {render};
}

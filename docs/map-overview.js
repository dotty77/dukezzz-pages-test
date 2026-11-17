/* Shared, functional shortcuts for both 2D map sources. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tools = [
    ['search', '点位筛选', '按名称、区域或类型查找点位'],
    ['route', '路线规划', '选择起点和目的地'],
    ['spawn', '出生位置', '查看本地图的固定出生位置'],
    ['exit', '撤离位置', '查看本地图的撤离配置地点'],
    ['gallery', '物资图鉴', '查看物资、原始动画与产出来源'],
    ['sources', '地图资料', '查看原始资料图与版本说明']
  ];
  function render({native = false, metrics = [], axisNote = ''} = {}) {
    const tiles = tools.map(([key, label, hint], index) => {
      const content = `<span class="tool-art" aria-hidden="true">${window.bagelToolIcons?.[key] || ''}</span><span class="tool-label">${label}</span>`;
      const attrs = `class="tool-tile" style="--tool-order:${index}" title="${hint}"`;
      return key === 'gallery' ? `<a ${attrs} href="gallery.html?v=20261117-team-lazy-beta-launch-1">${content}</a>` : `<button ${attrs} type="button" data-overview-action="${key}">${content}</button>`;
    }).join('');
    return `<section class="map-overview" aria-labelledby="map-tools-heading">
      <div class="overview-heading"><h2 id="map-tools-heading">地图工具</h2><span class="overview-view-label">${native ? '坐标图' : '资料图'}</span></div>
      <nav class="map-tools" aria-label="地图快捷工具">${tiles}</nav>
      <p class="overview-hint"><span aria-hidden="true">↖</span> 点选地图标记，查看地点详情</p>
      <div class="overview-section-heading"><h3>${native ? '配置概览' : '地图收录'}</h3><span>当前地图</span></div>
      <dl class="overview-metrics">${metrics.map(([value, label]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
      <details class="overview-notes"><summary>地图说明 <span aria-hidden="true">⌄</span></summary><div>
      ${native ? `<p>当前显示游戏原生导航轮廓。多层区域可能在俯视时重叠，可在左侧按高度筛选。</p><p id="native-axis-note">${escape(axisNote)}</p><p>默认显示高危相关候选，初始规则排除项及难度待核实项可在左侧展开。绿色菱形表示出生位置，绿色“撤”表示撤离配置地点。</p><p>导航面未显示完整建筑美术，也未合并本局门禁、传送与动态障碍。点位配置不代表每局必然出现。</p>`
        : `<p>点位按原作者资料图转录。点击标记可查看刷新分类、楼层、门禁条件和来源，也可以添加个人备注与访问清单。</p><p>高危全部容器及投入档位差异尚未完整核实；本局出生和撤离以游戏内状态为准。</p><p>门禁房的箱数独立汇总，房间入口不代表每个室内箱子的坐标。</p>`}
      </div></details>
    </section>`;
  }
  window.bagelOverview = Object.freeze({render});
  const motionVisibility = () => document.documentElement.classList.toggle('overview-motion-paused', document.hidden);
  document.addEventListener('visibilitychange', motionVisibility);
  motionVisibility();
})();

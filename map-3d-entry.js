// Keep the entry aligned with the selected 2D map, including direct map links.
(() => {
  const entry = document.querySelector('.map-3d-entry');
  if (!entry) return;
  const update = () => {
    const selected = window.atlas?.state.map || new URLSearchParams(location.search).get('map');
    const map = selected === 'suburbs' ? 'suburbs' : 'janus';
    entry.href = `${map}-3d.html?v=20261107-refresh-launch-1`;
  };
  window.addEventListener('atlasmapchange', update);
  window.addEventListener('atlasready', update);
  update();
})();

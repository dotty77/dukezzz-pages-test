// Only extracted source frames are drawn. Segments retain every original pixel.
const images = new Map();
const failedSources = new Set();
const maxDecodedBytes = 32 * 1024 * 1024;
let speculativeLoad = null;
const abortError = () => new DOMException('Animation loading cancelled', 'AbortError');

function trimImages() {
  let bytes = [...images.values()].reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  for (const [src, entry] of images) {
    if (bytes <= maxDecodedBytes && images.size <= 20) break;
    if (!entry.settled || entry.users) continue;
    images.delete(src); bytes -= entry.bytes || 0;
    // A playing canvas may still use this image; eviction only releases our reference.
  }
}

function loadImage(src, {signal, priority = 'high'} = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  let entry = images.get(src);
  if (!entry) {
    const image = new Image();
    image.decoding = 'async'; image.fetchPriority = priority;
    entry = {image, users: 0, settled: false, bytes: 0};
    images.set(src, entry);
    // A failed response may be cached by an edge. A user retry gets a fresh URL.
    const requestUrl = new URL(src, document.baseURI);
    if (failedSources.has(src)) requestUrl.searchParams.set('animation-retry', String(Date.now()));
    image.src = requestUrl.href;
    entry.promise = image.decode().then(() => {
      entry.settled = true;
      entry.bytes = image.naturalWidth * image.naturalHeight * 4;
      failedSources.delete(src);
      trimImages(); return image;
    }, error => {
      entry.settled = true;
      if (images.get(src) === entry) images.delete(src);
      if (!entry.cancelled) {
        failedSources.add(src);
        if (failedSources.size > 100) failedSources.delete(failedSources.values().next().value);
      }
      throw error;
    });
  } else {
    images.delete(src); images.set(src, entry);
    if (priority === 'high') entry.image.fetchPriority = 'high';
  }
  entry.users++;
  return new Promise((resolve, reject) => {
    let finished = false;
    function finish(error, image) {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', aborted); entry.users--;
      if (!entry.users && !entry.settled) {
        if (images.get(src) === entry) images.delete(src);
        entry.cancelled = true;
        entry.image.src = '';
      }
      trimImages();
      if (error) reject(error); else resolve(image);
    }
    const aborted = () => finish(abortError());
    signal?.addEventListener('abort', aborted, {once: true});
    entry.promise.then(image => finish(null, image), error => finish(error));
  });
}

// Warm only the first segment after hover/focus intent, never the whole gallery.
export function prefetchAnimation(animation) {
  const connection = navigator.connection;
  if (!animation || document.hidden || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || speculativeLoad) return;
  const src = animation.segments?.[0]?.src || animation.src;
  if (!src || images.has(src)) return;
  speculativeLoad = loadImage(src, {priority: 'low'}).catch(() => {}).finally(() => { speculativeLoad = null; });
}

export async function createSpritePlayer(canvas, animation, {onFrame = () => {}, onBuffering = () => {}, onError = () => {}, signal} = {}) {
  const columns = Number(animation.columns || 8), rows = Number(animation.rows || 8);
  const count = Number(animation.frameCount || animation.frames?.length || columns * rows);
  const segmented = Array.isArray(animation.segments) && animation.segments.length > 0;
  const segments = segmented ? animation.segments : [{src: animation.src, startFrame: 0, frameCount: count, columns, rows}];
  let covered = 0;
  for (const part of segments) {
    if (!part.src || part.startFrame !== covered || ![part.columns, part.rows, part.frameCount].every(n => Number.isInteger(n) && n > 0) || part.frameCount > part.columns * part.rows && !animation.frames) throw new Error('动画分段布局无效');
    covered += part.frameCount;
  }
  if (!Number.isInteger(count) || count < 1 || covered !== count) throw new Error('动画帧数无效');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) controller.abort();
  let first;
  try { first = await loadImage(segments[0].src, {signal: controller.signal}); }
  catch (error) { signal?.removeEventListener('abort', cancel); throw error; }
  if (controller.signal.aborted) { signal?.removeEventListener('abort', cancel); throw abortError(); }
  const width = Number(animation.frameWidth || first.naturalWidth / segments[0].columns);
  const height = Number(animation.frameHeight || first.naturalHeight / segments[0].rows);
  if (![width, height].every(n => Number.isInteger(n) && n > 0)) { signal?.removeEventListener('abort', cancel); throw new Error('动画画面尺寸无效'); }
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const fps = Number(animation.fps) > 0 ? Number(animation.fps) : 24;
  const loaded = new Map([[0, first]]), pending = new Map();
  let frame = 0, playing = false, disposed = false, raf = 0, baseTime = 0, buffering = false, seekGeneration = 0, seeking = false;
  const indexFor = n => segments.findIndex(part => n >= part.startFrame && n < part.startFrame + part.frameCount);
  function setBuffering(value) { if (buffering !== value) { buffering = value; onBuffering(value); } }
  function request(index) {
    if (loaded.has(index)) return Promise.resolve(loaded.get(index));
    if (pending.has(index)) return pending.get(index);
    const promise = loadImage(segments[index].src, {signal: controller.signal}).then(image => {
      if (!disposed) loaded.set(index, image);
      return image;
    }).finally(() => pending.delete(index));
    pending.set(index, promise); return promise;
  }
  function fail(error) {
    if (disposed || error.name === 'AbortError') return;
    pause(); setBuffering(false); onError(error);
  }
  function pump() {
    if (!playing || disposed || document.hidden) return;
    const current = indexFor(frame);
    for (let offset = 0; offset < segments.length && pending.size < 2; offset++) {
      const index = (current + offset) % segments.length;
      if (loaded.has(index) || pending.has(index)) continue;
      request(index).then(() => pump(), fail);
    }
  }
  function draw(next) {
    const index = indexFor(next), image = loaded.get(index), part = segments[index];
    if (!image) return false;
    const local = next - part.startFrame, rectangle = !segmented && animation.frames?.[next];
    const row = Math.floor(local / part.columns);
    const top = !segmented && animation.origin === 'bottom-left' ? part.rows - row - 1 : row;
    ctx.clearRect(0, 0, width, height);
    if (rectangle) ctx.drawImage(image, rectangle.x, rectangle.y, rectangle.width, rectangle.height, 0, 0, width, height);
    else ctx.drawImage(image, local % part.columns * width, top * height, width, height, 0, 0, width, height);
    frame = next; canvas.dataset.frame = String(frame); onFrame(frame, count); return true;
  }
  function tick(time) {
    if (!playing || disposed || document.hidden) { raf = 0; return; }
    if (!seeking) {
      const steps = Math.min(count, Math.floor((time - baseTime) * fps / 1000));
      let moved = 0, next = frame;
      while (moved < steps && loaded.has(indexFor((next + 1) % count))) { next = (next + 1) % count; moved++; }
      if (moved) draw(next);
      if (moved < steps) { baseTime = time; setBuffering(true); pump(); }
      else { baseTime += moved * 1000 / fps; if (moved) setBuffering(false); }
    }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (disposed || playing) return;
    playing = true; baseTime = performance.now(); pump();
    if (!document.hidden) raf = requestAnimationFrame(tick);
  }
  function pause() { playing = false; cancelAnimationFrame(raf); raf = 0; }
  function visibility() {
    cancelAnimationFrame(raf); raf = 0;
    if (!document.hidden && playing) { baseTime = performance.now(); pump(); raf = requestAnimationFrame(tick); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; pause(); controller.abort();
    signal?.removeEventListener('abort', cancel);
    document.removeEventListener('visibilitychange', visibility);
    loaded.clear(); canvas.width = 1; canvas.height = 1;
  }
  controller.signal.addEventListener('abort', dispose, {once: true});
  document.addEventListener('visibilitychange', visibility);
  draw(0);
  return {
    play, pause,
    async seek(next) {
      if (disposed || !Number.isFinite(Number(next))) return;
      const target = Math.max(0, Math.min(count - 1, Math.round(Number(next)))), generation = ++seekGeneration;
      seeking = true;
      try { await request(indexFor(target)); if (!disposed && generation === seekGeneration) { draw(target); baseTime = performance.now(); setBuffering(false); } }
      catch (error) { fail(error); }
      finally { if (generation === seekGeneration) seeking = false; }
    },
    get playing() { return playing; }, get frame() { return frame; }, count, fps, dispose
  };
}

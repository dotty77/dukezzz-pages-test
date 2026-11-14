/* Optional public-resource caching. Registration and warming run asynchronously. */
(() => {
  'use strict';
  const build = document.currentScript?.dataset.cacheBuild;
  if (typeof build !== 'string' || !build || build.length > 200) return;
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;

  try {
    const serviceWorkers = navigator.serviceWorker;
    const workerUrl = new URL('/dukezzz-pages-test/resource-cache-sw.js', location.origin);
    const isOurWorker = worker => {
      if (!worker) return false;
      try {
        const url = new URL(worker.scriptURL);
        return url.origin === workerUrl.origin && url.pathname === workerUrl.pathname;
      } catch { return false; }
    };
    let loaded = document.readyState === 'complete';
    let readyController = null;
    let warmSent = false;
    const warm = () => {
      if (!loaded || warmSent || !readyController
          || readyController !== serviceWorkers.controller || !isOurWorker(readyController)) return;
      try {
        const urls = new Set();
        for (const entry of performance.getEntriesByType('resource')) {
          try {
            const url = new URL(entry.name);
            const queryKeys = [...url.searchParams.keys()];
            if (url.origin !== location.origin || url.protocol !== workerUrl.protocol || url.username || url.password
                || !url.pathname.startsWith('/dukezzz-pages-test/') || url.pathname === '/dukezzz-pages-test/api' || url.pathname.startsWith('/dukezzz-pages-test/api/')
                || (queryKeys.length && (queryKeys.length !== 1 || queryKeys[0] !== 'v'))) continue;
            url.hash = '';
            urls.add(url.href);
            if (urls.size === 64) break;
          } catch { /* Ignore malformed performance entries. */ }
        }
        warmSent = true;
        readyController.postMessage({ type: 'duke-resource-cache:warm', build, urls: [...urls] });
      } catch { /* Warming is optional and never fetches from the page itself. */ }
    };
    const hello = () => {
      try {
        const controller = serviceWorkers.controller;
        if (isOurWorker(controller)) {
          controller.postMessage({ type: 'duke-resource-cache:hello', build });
        }
      } catch { /* Storage and worker failures must not interrupt the page. */ }
    };

    serviceWorkers.addEventListener('controllerchange', hello);
    serviceWorkers.addEventListener('message', event => {
      if (event.source !== serviceWorkers.controller || !isOurWorker(event.source)) return;
      if (event.data?.type === 'duke-resource-cache:hello-needed') hello();
      if (event.data?.type === 'duke-resource-cache:ready' && event.data.build === build) {
        readyController = event.source;
        warm();
      }
    });
    window.addEventListener('load', () => { loaded = true; warm(); }, { once: true });
    window.addEventListener('pageshow', hello);
    hello();

    void (async () => {
      try {
        const existing = await serviceWorkers.getRegistration('/dukezzz-pages-test/');
        // Leave any unrelated root worker and its registration untouched.
        if (existing && [existing.active, existing.waiting, existing.installing]
          .some(worker => worker && !isOurWorker(worker))) return;
        if (serviceWorkers.controller && !isOurWorker(serviceWorkers.controller)) return;
        const registration = await serviceWorkers.register(workerUrl.pathname, {
          scope: '/dukezzz-pages-test/', updateViaCache: 'none',
        });
        hello();
        await registration.update();
      } catch { /* The site continues using the browser's normal network path. */ }
    })();
  } catch { /* Service workers may be unavailable in private or restricted browsing. */ }
})();

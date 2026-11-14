// Static reference files are optional; a slow response must not lock the tool.
export async function fetchTuningJSON(url, {timeout = 8000} = {}) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('资料加载超时，请检查网络后刷新重试。'));
      controller.abort();
    }, timeout);
  });
  try {
    return await Promise.race([
      fetch(url, {signal: controller.signal}).then(response => {
        if (!response.ok) throw new Error('资料暂未加载，请检查网络后刷新重试。');
        return response.json();
      }),
      expired
    ]);
  } finally { clearTimeout(timer); }
}

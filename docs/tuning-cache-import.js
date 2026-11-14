/* Local Chromium-cache extraction, based on the public record layout (1/0/ + URL + NUL).
   This module reads only the Blob supplied by the user. It never sends or stores its contents.
   Candidates preserve the original query text; the caller checks validity with the official API. */
export const CACHE_IMPORT_LIMITS = Object.freeze({
  bytes: 128 * 1024 * 1024,
  chunkBytes: 256 * 1024,
  urlChars: 32768,
  candidates: 1000
});

const marker = '1/0/https://';
const officialPrefix = /^https:\/\/(?:public-operation-nap\.mihoyo\.com|public-operation-nap-sg\.hoyoverse\.com|public-operation-common-sg\.hoyoverse\.com)(?::443)?\/common\/gacha_record\/api\/getGachaLog\?/;
const hosts = new Set(['public-operation-nap.mihoyo.com', 'public-operation-nap-sg.hoyoverse.com','public-operation-common-sg.hoyoverse.com']);
const endpoint = '/common/gacha_record/api/getGachaLog';

function cancelled(signal) {
  if (signal?.aborted) throw new DOMException('已取消读取缓存。', 'AbortError');
}

function isOfficialCandidate(value) {
  // Check the literal authority and path before URL parsing, which otherwise normalizes
  // encoded hosts, dot segments, backslashes and alternate spellings of a URL.
  if (!officialPrefix.test(value) || /[\u0000-\u0020\u007f\ufffd#]/u.test(value)) return false;
  try {
    const url = new URL(value);
    if(url.hostname==='public-operation-common-sg.hoyoverse.com' && url.searchParams.get('game_biz')!=='nap_global')return false;
    return url.protocol === 'https:' && hosts.has(url.hostname) && url.port === '' &&
      url.username === '' && url.password === '' && url.pathname === endpoint && url.hash === '';
  } catch { return false; }
}

/**
 * Return unique official getGachaLog candidates, newest occurrence in the file first.
 * The order refers to physical cache position; it is not a server timestamp or validity check.
 * @param {Blob} file User-selected data_2 file (Blob is also supported for local tests).
 * @param {{signal?: AbortSignal}} options
 * @returns {Promise<string[]>} Original URL strings, including their unmodified query strings.
 */
export async function extractCacheLinks(file, { signal } = {}) {
  cancelled(signal);
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.slice !== 'function') {
    throw new TypeError('请选择游戏缓存 data_2 文件。');
  }
  if (file.size > CACHE_IMPORT_LIMITS.bytes) throw new RangeError('缓存文件超过 128 MiB，请选择最新缓存目录中的 data_2 文件。');
  if (file.size === 0) return [];

  const decoder = new TextDecoder('utf-8');
  const found = new Map();
  let carry = '';

  function remember(value) {
    if (!value || value.length > CACHE_IMPORT_LIMITS.urlChars || !isOfficialCandidate(value)) return;
    if (found.has(value)) found.delete(value);
    else if (found.size >= CACHE_IMPORT_LIMITS.candidates) {
      throw new RangeError('缓存中候选链接超过 1000 条，请使用最新缓存目录中的 data_2 文件。');
    }
    // Reinsert duplicates so Map insertion order tracks their latest physical occurrence.
    found.set(value, true);
  }

  function scan(text, final) {
    let offset = 0;
    carry = '';
    while (offset < text.length) {
      cancelled(signal);
      const entry = text.indexOf(marker, offset);
      if (entry === -1) {
        // Enough suffix to recognize a marker split across the next block boundary.
        if (!final) carry = text.slice(-marker.length + 1);
        return;
      }
      const start = entry + 4;
      const nul = text.indexOf('\0', start);
      const next = text.indexOf(marker, start);
      const end = nul === -1 ? next : next === -1 ? nul : Math.min(nul, next);
      if (end === -1) {
        if (text.length - start <= CACHE_IMPORT_LIMITS.urlChars) {
          if (final) remember(text.slice(start));
          else carry = text.slice(entry);
        } else if (!final) {
          // Discard an oversized record without buffering it until its terminator.
          carry = text.slice(-marker.length + 1);
        }
        return;
      }
      if (end - start <= CACHE_IMPORT_LIMITS.urlChars) remember(text.slice(start, end));
      // A following marker starts another record even when no NUL separates the two.
      offset = end === next ? end : end + 1;
    }
  }

  for (let offset = 0; offset < file.size; offset += CACHE_IMPORT_LIMITS.chunkBytes) {
    cancelled(signal);
    const chunk = file.slice(offset, Math.min(offset + CACHE_IMPORT_LIMITS.chunkBytes, file.size));
    if (!chunk || typeof chunk.arrayBuffer !== 'function') throw new TypeError('当前浏览器无法读取此缓存文件。');
    const bytes = await chunk.arrayBuffer();
    cancelled(signal);
    let text = decoder.decode(bytes, { stream: true });
    // The source script also accepts a URL at the very beginning of its first record.
    if (offset === 0 && text.startsWith('https://')) text = '1/0/' + text;
    scan(carry + text, false);
  }
  cancelled(signal);
  scan(carry + decoder.decode(), true);
  return [...found.keys()].reverse();
}

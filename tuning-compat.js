/* Small helpers for this page's arrays and plain archive data. No prototype changes. */
export function findLastIndex(array, predicate) {
  if (typeof predicate !== 'function') throw new TypeError('Expected a predicate function');
  for (let index = array.length - 1; index >= 0; index--) {
    if (predicate(array[index], index, array)) return index;
  }
  return -1;
}

export function cloneData(value) {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  const seen = new WeakMap();
  function unsupported() {
    const error = typeof DOMException === 'function'
      ? new DOMException('Only plain archive data can be copied', 'DataCloneError')
      : Object.assign(new Error('Only plain archive data can be copied'), {name:'DataCloneError'});
    throw error;
  }
  function copy(input) {
    if (typeof input === 'function' || typeof input === 'symbol') unsupported();
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) return seen.get(input);
    const isArray = Array.isArray(input), prototype = Object.getPrototypeOf(input);
    if (!isArray && prototype !== Object.prototype && prototype !== null) unsupported();
    const output = isArray ? new Array(input.length) : {};
    seen.set(input, output);
    for (const key of Object.keys(input)) {
      // Defining an own property also safely preserves a literal __proto__ key.
      Object.defineProperty(output, key, {value:copy(input[key]), enumerable:true, writable:true, configurable:true});
    }
    return output;
  }
  return copy(value);
}

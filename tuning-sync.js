// Detect accidental archive replacement by older tabs which do not update linkSync.
// This local change detector is not an authentication or cryptographic checksum.
export function archiveStamp(account) {
  const text=JSON.stringify([account.uid,account.timezone,account.records]);
  let first=2166136261,second=5381;
  for(let i=0;i<text.length;i++) {
    const code=text.charCodeAt(i);
    first=Math.imul(first^code,16777619);
    second=(Math.imul(second,33)^code)>>>0;
  }
  return `${text.length}:${first>>>0}:${second>>>0}`;
}

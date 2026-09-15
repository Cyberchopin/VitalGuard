// Export integrity, NOT authentication: retain the digest separately to detect replacement.
export function canonical(value) {
  if(value===null || typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
async function digest(value){
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function sealReport(report) {
  const payload=structuredClone(report);
  return {format:'vitalguard-integrity-v1',algorithm:'SHA-256',digest:await digest(payload),payload};
}
export async function verifyReport(sealed,expectedDigest) {
  if(!sealed || sealed.format!=='vitalguard-integrity-v1' || sealed.algorithm!=='SHA-256' || !sealed.payload || !Array.isArray(sealed.payload.events))return false;
  if(expectedDigest && sealed.digest!==expectedDigest)return false;
  const events=sealed.payload.events;
  if(events.some((e,i)=>e.id!==`E${String(i+1).padStart(3,'0')}` || !Number.isFinite(e.t) || (i>0&&e.t<events[i-1].t)))return false;
  return sealed.digest===await digest(sealed.payload);
}

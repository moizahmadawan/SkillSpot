// Blocks MongoDB operator injection: removes keys that start with "$" or contain "." from body/query/params.
const bad = (k) => k.startsWith('$') || k.includes('.');
function strip(o) {
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (bad(k)) delete o[k]; else strip(o[k]); }
  return o;
}
export const sanitize = (req, _res, next) => { strip(req.body); strip(req.query); strip(req.params); next(); };

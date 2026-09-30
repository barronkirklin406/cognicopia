/* =====================================================================
   A small JSON Schema checker for the coloring catalogs: the parts of
   draft 2020-12 the catalog schemas use (type, enum, const, pattern,
   minimum/maximum, minLength, minItems/maxItems, uniqueItems, required,
   properties, additionalProperties, items, $ref into $defs). Returns a
   list of problems, each with the JSON path where it was found.
   Node built-ins only.
   ===================================================================== */
const typeOf = v => v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
const isType = (v, t) => t === "number" ? typeof v === "number" && Number.isFinite(v) : t === "integer" ? Number.isInteger(v) : typeOf(v) === t;

export function validate(value, schema, root = schema, at = "$", out = []){
  if (schema === true || schema == null) return out;
  if (schema === false){ out.push(at + ": not allowed"); return out; }
  if (schema.$ref){
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    if (!m || !root.$defs || !root.$defs[m[1]]){ out.push(at + ": unknown $ref " + schema.$ref); return out; }
    return validate(value, root.$defs[m[1]], root, at, out);
  }
  if (schema.type){
    const types = [].concat(schema.type);
    if (!types.some(t => isType(value, t))){ out.push(`${at}: expected ${types.join(" or ")}, got ${typeOf(value)}`); return out; }
  }
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) out.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) out.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.map(e => JSON.stringify(e)).join(", ")}`);
  if (typeof value === "string"){
    if (schema.minLength != null && value.length < schema.minLength) out.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) out.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) out.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  }
  if (typeof value === "number"){
    if (schema.minimum != null && value < schema.minimum) out.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) out.push(`${at}: above ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) out.push(`${at}: must be above ${schema.exclusiveMinimum}`);
  }
  if (Array.isArray(value)){
    if (schema.minItems != null && value.length < schema.minItems) out.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) out.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems){ const seen = new Set(); value.forEach((v, i) => { const k = JSON.stringify(v); if (seen.has(k)) out.push(`${at}[${i}]: repeated`); seen.add(k); }); }
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, root, `${at}[${i}]`, out));
  }
  if (typeOf(value) === "object"){
    (schema.required || []).forEach(k => { if (!(k in value)) out.push(`${at}: missing ${k}`); });
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)){
      if (props[k]) validate(v, props[k], root, `${at}.${k}`, out);
      else if (schema.additionalProperties === false) out.push(`${at}: unexpected property ${k}`);
      else if (typeof schema.additionalProperties === "object") validate(v, schema.additionalProperties, root, `${at}.${k}`, out);
    }
  }
  return out;
}

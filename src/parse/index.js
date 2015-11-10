const parsers = Object.create(null)

export function convertFrom(schema, value, format, arg) {
  let converter = parsers[format]
  if (!converter) throw new Error("Source format " + format + " not defined")
  return converter(schema, value, arg)
}

export function knownSource(format) { return !!parsers[format] }

export function defineSource(format, func) { parsers[format] = func }

defineSource("json", (schema, json) => schema.nodeFromJSON(json))

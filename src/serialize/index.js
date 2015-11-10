const serializers = Object.create(null)

export function convertTo(doc, format, arg) {
  let converter = serializers[format]
  if (!converter) throw new Error("Target format " + format + " not defined")
  return converter(doc, arg)
}

export function knownTarget(format) { return !!serializers[format] }

export function defineTarget(format, func) { serializers[format] = func }

defineTarget("json", doc => doc.toJSON())

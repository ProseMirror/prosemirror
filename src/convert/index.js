import {$fromJSON} from "../model"

const from = Object.create(null)
const to = Object.create(null)

export function convertFrom(value, format, arg) {
  let converter = from[format]
  if (!converter) throw new Error("Source format " + format + " not defined")
  return converter(value, arg)
}

export function convertTo(doc, format, arg) {
  let converter = to[format]
  if (!converter) throw new Error("Target format " + format + " not defined")
  return converter(doc, arg)
}

export function knownSource(format) { return !!from[format] }
export function knownTarget(format) { return !!to[format] }

export function defineSource(format, func) { from[format] = func }
export function defineTarget(format, func) { to[format] = func }

defineSource("json", json => $fromJSON(json))
defineTarget("json", doc => doc.toJSON())

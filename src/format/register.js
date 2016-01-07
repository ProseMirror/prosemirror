import {NamespaceError} from "../util/error"

const serializers = Object.create(null)

// :: (Node, string, ?Object) → any
// Serialize the given document to the given format. If `options` is
// given, it will be passed along to the serializer function.
export function serializeTo(doc, format, options) {
  let converter = serializers[format]
  if (!converter) NamespaceError.raise("Target format " + format + " not defined")
  return converter(doc, options)
}

// :: (string) → bool
// Query whether a given serialization format has been registered.
export function knownTarget(format) { return !!serializers[format] }

// :: (string, (Node, ?Object) → any)
// Register a function as the serializer for `format`.
export function defineTarget(format, func) { serializers[format] = func }

defineTarget("json", doc => doc.toJSON())

const parsers = Object.create(null)

// :: (Schema, any, string, ?Object) → Node
// Parse document `value` from the format named by `format`. If
// `options` is given, it is passed along to the parser function.
export function parseFrom(schema, value, format, options) {
  let converter = parsers[format]
  if (!converter) NamespaceError.raise("Source format " + format + " not defined")
  return converter(schema, value, options)
}

// :: (string) → bool
// Query whether a parser for the named format has been registered.
export function knownSource(format) { return !!parsers[format] }

// :: (string, (Schema, any, ?Object) → Node)
// Register a parser function for `format`.
export function defineSource(format, func) { parsers[format] = func }

defineSource("json", (schema, json) => schema.nodeFromJSON(json))

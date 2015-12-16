// !! This module provides a way to register and access functions that
// serialize ProseMirror [documents](#Node) to various formats. To
// load the actual serializers, you need to include submodules of this
// module (or 3rd party serialization modules), which will register
// themselves to this module.
//
// These are the serializers defined:
//
// **`"json"`**
//   : Use `Node.toJSON` to serialize the node as JSON. Defined by the
//     top-level `serialize` module.
//
// **`"dom"`**
//   : Serialize to a [DOM
//     fragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment).
//     Defined in `serialize/dom`. See `toDOM`.
//
// **`"html"`**
//   : Serialize to HTML text. Defined in `serialize/dom`. See `toHTML`.
//
// **`"markdown"`**
//   : Serialize to [CommonMark](http://commonmark.org/) marked-up
//     text. Defined in `serialize/markdown`. See `toMarkdown`.
//
// **`"text"`**
//   : Serialize to plain text. Defined in `serialize/text`. See `toText`.

const serializers = Object.create(null)

// :: (Node, string, ?Object) → any
// Serialize the given document to the given format. If `options` is
// given, it will be passed along to the serializer function.
export function serializeTo(doc, format, options) {
  let converter = serializers[format]
  if (!converter) throw new Error("Target format " + format + " not defined")
  return converter(doc, options)
}

// :: (string) → bool
// Query whether a given serialization format has been registered.
export function knownTarget(format) { return !!serializers[format] }

// :: (string, (Node, ?Object) → any)
// Register a function as the serializer for `format`.
export function defineTarget(format, func) { serializers[format] = func }

defineTarget("json", doc => doc.toJSON())

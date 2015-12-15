// !! This module implements a way to register and access parsers from
// various input formats to ProseMirror's [document format](#Node). To
// load the actual parsers, you need to import parser modules like
// `parse/dom` or `parse/markdown`, which will then register
// themselves here, as well as export special-purpose parsing
// functions.
//
// These are the parses in the distribution:
//
// **`"json"`**
//   : The top-level module defines a single parser `"json"`, which
//     uses `Node.fromJSON` to parse JSON data.
//
// **`"dom"`**
//   : Parses [DOM
//     nodes](https://developer.mozilla.org/en-US/docs/Web/API/Node).
//     Defined in `parse/dom`. See `fromDOM`.
//
// **`"html"`**
//   : Parses strings of HTML content. Defined in `parse/dom`.
//
// **`"markdown"`**
//   : Parses strings of
//     [CommonMark](http://commonmark.org/)-formatted text. Defined in
//     `parse/markdown`. See `fromMarkdown`.
//
// **`"text"`**
//   : Simply splits a string of text on blank lines and creates a
//     document containing those lines as paragraphs. Defined in
//     `parse/text`. See `fromText`.

const parsers = Object.create(null)

// :: (Schema, any, string, ?Object) → Node
// Parse document `value` from the format named by `format`. If
// `options` is given, it is passed along to the parser function.
export function from(schema, value, format, options) {
  let converter = parsers[format]
  if (!converter) throw new Error("Source format " + format + " not defined")
  return converter(schema, value, options)
}

// :: (string) → bool
// Query whether a parser for the named format has been registered.
export function knownSource(format) { return !!parsers[format] }

// :: (string, (Schema, any, ?Object) → Node)
// Register a parser function for `format`.
export function defineSource(format, func) { parsers[format] = func }

defineSource("json", (schema, json) => schema.nodeFromJSON(json))

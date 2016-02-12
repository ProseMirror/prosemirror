// !! This module provides a way to register and access functions that
// serialize and parse ProseMirror [documents](#Node) to and from
// various formats, along with the basic formats required to run the
// editor.
//
// These are the formats defined by this module:
//
// **`"json"`**
//   : Uses `Node.toJSON` and `Schema.nodeFromJSON` to convert a
//     document to and from JSON.
//
// **`"dom"`**
//   : Parses [DOM
//     Nodes](https://developer.mozilla.org/en-US/docs/Web/API/Node),
//     serializes to a [DOM
//     fragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment).
//     See `toDOM` and `fromDOM`.
//
// **`"html"`**
//   : Serialize to and parse from HTML text. See `toHTML` and `fromHTML`.
//
// **`"text"`**
//   : Convert to and from plain text. See `toText` and `fromText`.
//
// The [`markdown`](#markdown) module in the distribution defines an additional format:
//
// **`"markdown"`**
//   : Convert to and from [CommonMark](http://commonmark.org/) marked-up
//     text. See `toMarkdown` and `fromMarkdown`.

export {serializeTo, knownTarget, defineTarget, parseFrom, knownSource, defineSource} from "./register"

export {fromDOM, fromHTML} from "./from_dom"
export {toDOM, toHTML, nodeToDOM} from "./to_dom"

export {fromText} from "./from_text"
export {toText} from "./to_text"

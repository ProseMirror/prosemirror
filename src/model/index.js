// !!
// This module defines ProseMirror's document model, the data
// structure used to define and inspect content documents. It
// includes:
//
// * The [node](#Node) type that represents document elements
//
// * The [schema](#Schema) types used to tag and constrain the
//   document structure
//
// This module does not depend on the browser API being available
// (i.e. you can load it into any JavaScript environment).

exports.Node = require("./node").Node
;({ResolvedPos: exports.ResolvedPos, NodeRange: exports.NodeRange} = require("./resolvedpos"))
exports.Fragment = require("./fragment").Fragment
;({Slice: exports.Slice, ReplaceError: exports.ReplaceError} = require("./replace"))
exports.Mark = require("./mark").Mark

;({SchemaSpec: exports.SchemaSpec, Schema: exports.Schema, NodeType: exports.NodeType,
   Block: exports.Block, Inline: exports.Inline, Text: exports.Text,
   MarkType: exports.MarkType, Attribute: exports.Attribute, NodeKind: exports.NodeKind} = require("./schema"))
;({ContentMatch: exports.ContentMatch} = require("./content"))

exports.parseDOMInContext = require("./from_dom").parseDOMInContext

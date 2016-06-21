// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

exports.ProseMirror = require("./main").ProseMirror
;({Selection: exports.Selection, TextSelection: exports.TextSelection, NodeSelection: exports.NodeSelection} = require("./selection"))
;({MarkedRange: exports.MarkedRange} = require("./range"))
;({Plugin: exports.Plugin} = require("./plugin"))

exports.Keymap = require("browserkeymap")

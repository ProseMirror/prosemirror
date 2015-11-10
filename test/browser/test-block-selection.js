import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, img, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpStr, P} from "../cmp"

const test = namespace("node-selection")

test("parent-block", pm => {
  pm.setSelection(P(0, 0, 1, 1))
  pm.execCommand("selectParentBlock")
  cmp(pm.selection.node, pm.doc.path([0, 0, 1]), "to paragraph")
  pm.execCommand("selectParentBlock")
  cmp(pm.selection.node, pm.doc.path([0, 0]), "to list item")
  pm.execCommand("selectParentBlock")
  cmp(pm.selection.node, pm.doc.path([0]), "to list")
  pm.execCommand("selectParentBlock")
  cmp(pm.selection.node, pm.doc.path([0]), "stop at toplevel")
}, {doc: doc(ul(li(p("foo"), p("bar")), li(p("baz"))))})

test("through-inline-node", pm => {
  pm.setSelection(P(0, 3))
  pm.execCommand("selectBlockRight")
  let i = pm.doc.child(0).child(1)
  cmp(pm.selection.node, i, "moved right onto image")
  cmpStr(pm.selection.anchor, P(0, 3), "anchor of node selection before")
  cmpStr(pm.selection.head, P(0, 4), "head of node selection after")
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.head, P(0, 4), "moved right past")
  cmpStr(pm.selection.anchor, P(0, 4), "moved right past'")
  pm.execCommand("selectBlockLeft")
  cmp(pm.selection.node, i, "moved left onto image")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.head, P(0, 3), "moved left past")
  cmpStr(pm.selection.anchor, P(0, 3), "moved left past'")
}, {doc: doc(p("foo", img, "bar"))})

test("onto-block", pm => {
  pm.setSelection(P(0, 5))
  pm.execCommand("selectBlockDown")
  cmp(pm.selection.node, pm.doc.child(1), "moved down onto hr")
  pm.setSelection(P(2, 0, 0, 0))
  pm.execCommand("selectBlockUp")
  cmp(pm.selection.node, pm.doc.child(1), "moved up onto hr")
}, {doc: doc(p("hello"), hr, ul(li(p("there"))))})

test("through-double-block", pm => {
  pm.setSelection(P(0, 0, 5))
  pm.execCommand("selectBlockDown")
  cmp(pm.selection.node, pm.doc.child(1), "moved down onto hr")
  pm.execCommand("selectBlockDown")
  cmp(pm.selection.node, pm.doc.child(2), "moved down onto second hr")
  pm.setSelection(P(3, 0))
  pm.execCommand("selectBlockUp")
  cmp(pm.selection.node, pm.doc.child(2), "moved up onto second hr")
  pm.execCommand("selectBlockUp")
  cmp(pm.selection.node, pm.doc.child(1), "moved up onto hr")
}, {doc: doc(blockquote(p("hello")), hr, hr, p("there"))})

test("horizontally-through-block", pm => {
  pm.setSelection(P(0, 3))
  pm.execCommand("selectBlockRight")
  cmp(pm.selection.node, pm.doc.child(1), "right into first hr")
  pm.execCommand("selectBlockRight")
  cmp(pm.selection.node, pm.doc.child(2), "right into second hr")
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.head, P(3, 0), "right out of hr")
  pm.execCommand("selectBlockLeft")
  cmp(pm.selection.node, pm.doc.child(2), "left into second hr")
  pm.execCommand("selectBlockLeft")
  cmp(pm.selection.node, pm.doc.child(1), "left into first hr")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.head, P(0, 3), "left out of hr")
}, {doc: doc(p("foo"), hr, hr, p("bar"))})

test("block-out-of-image", pm => {
  pm.setNodeSelection(P(0, 3))
  pm.execCommand("selectBlockDown")
  cmp(pm.selection.node, pm.doc.child(1), "down into hr")
  pm.setNodeSelection(P(2, 0))
  pm.execCommand("selectBlockUp")
  cmp(pm.selection.node, pm.doc.child(1), "up into hr")
}, {doc: doc(p("foo", img), hr, p(img, "bar"))})

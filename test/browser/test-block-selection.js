import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, img, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpStr, cmpNode, P} from "../cmp"

const test = namespace("node-selection")

test("parent-block", pm => {
  pm.setSelection(P(0, 0, 1, 1))
  pm.execCommand("selectParentBlock")
  cmpStr(pm.selection.nodePos, P(0, 0, 1), "to paragraph")
  pm.execCommand("selectParentBlock")
  cmpStr(pm.selection.nodePos, P(0, 0), "to list item")
  pm.execCommand("selectParentBlock")
  cmpStr(pm.selection.nodePos, P(0), "to list")
  pm.execCommand("selectParentBlock")
  cmpStr(pm.selection.nodePos, P(0), "stop at toplevel")
}, {doc: doc(ul(li(p("foo"), p("bar")), li(p("baz"))))})

test("through-inline-node", pm => {
  pm.setSelection(P(0, 3))
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.nodePos, P(0, 3), "moved right onto image")
  cmpStr(pm.selection.anchor, P(0, 3), "anchor of node selection before")
  cmpStr(pm.selection.head, P(0, 4), "head of node selection after")
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.head, P(0, 4), "moved right past")
  cmpStr(pm.selection.anchor, P(0, 4), "moved right past'")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.nodePos, P(0, 3), "moved left onto image")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.head, P(0, 3), "moved left past")
  cmpStr(pm.selection.anchor, P(0, 3), "moved left past'")
}, {doc: doc(p("foo", img, "bar"))})

test("onto-block", pm => {
  pm.setSelection(P(0, 5))
  pm.execCommand("selectBlockDown")
  cmpStr(pm.selection.nodePos, P(1), "moved down onto hr")
  pm.setSelection(P(2, 0, 0, 0))
  pm.execCommand("selectBlockUp")
  cmpStr(pm.selection.nodePos, P(1), "moved up onto hr")
}, {doc: doc(p("hello"), hr, ul(li(p("there"))))})

test("through-double-block", pm => {
  pm.setSelection(P(0, 0, 5))
  pm.execCommand("selectBlockDown")
  cmpStr(pm.selection.nodePos, P(1), "moved down onto hr")
  pm.execCommand("selectBlockDown")
  cmpStr(pm.selection.nodePos, P(2), "moved down onto second hr")
  pm.setSelection(P(3, 0))
  pm.execCommand("selectBlockUp")
  cmpStr(pm.selection.nodePos, P(2), "moved up onto second hr")
  pm.execCommand("selectBlockUp")
  cmpStr(pm.selection.nodePos, P(1), "moved up onto hr")
}, {doc: doc(blockquote(p("hello")), hr, hr, p("there"))})

test("horizontally-through-block", pm => {
  pm.setSelection(P(0, 3))
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.nodePos, P(1), "right into first hr")
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.nodePos, P(2), "right into second hr")
  pm.execCommand("selectBlockRight")
  cmpStr(pm.selection.head, P(3, 0), "right out of hr")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.nodePos, P(2), "left into second hr")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.nodePos, P(1), "left into first hr")
  pm.execCommand("selectBlockLeft")
  cmpStr(pm.selection.head, P(0, 3), "left out of hr")
}, {doc: doc(p("foo"), hr, hr, p("bar"))})

test("block-out-of-image", pm => {
  pm.setNodeSelection(P(0, 3))
  pm.execCommand("selectBlockDown")
  cmpStr(pm.selection.nodePos, P(1), "down into hr")
  pm.setNodeSelection(P(2, 0))
  pm.execCommand("selectBlockUp")
  cmpStr(pm.selection.nodePos, P(1), "up into hr")
}, {doc: doc(p("foo", img), hr, p(img, "bar"))})

test("lift-preserves", pm => {
  pm.setNodeSelection(P(0, 0, 0, 0))
  pm.execCommand("lift")
  cmpNode(pm.doc, doc(ul(li(p("hi")))), "lifted")
  cmpStr(pm.selection.nodePos, P(0, 0, 0), "preserved selection")
  pm.execCommand("lift")
  cmpNode(pm.doc, doc(p("hi")), "lifted again")
  cmpStr(pm.selection.nodePos, P(0), "preserved selection again")
}, {doc: doc(ul(li(blockquote(p("hi")))))})

test("lift-at-selection-level", pm => {
  pm.setNodeSelection(P(0, 0))
  pm.execCommand("lift")
  cmpNode(pm.doc, doc(ul(li(p("a")), li(p("b")))), "lifted list")
  cmpStr(pm.selection.nodePos, P(0), "preserved selection")
}, {doc: doc(blockquote(ul(li(p("a")), li(p("b")))))})

test("join-precisely-down", pm => {
  pm.setNodeSelection(P(0, 0))
  cmp(pm.execCommand("joinDown"), false, "don't join parent")
  pm.setNodeSelection(P(0))
  pm.execCommand("joinDown")
  cmpNode(pm.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmpStr(pm.selection.nodePos, P(0), "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

test("join-precisely-up", pm => {
  pm.setNodeSelection(P(1, 0))
  cmp(pm.execCommand("joinUp"), false, "don't join parent")
  pm.setNodeSelection(P(1))
  pm.execCommand("joinUp")
  cmpNode(pm.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmpStr(pm.selection.nodePos, P(0), "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

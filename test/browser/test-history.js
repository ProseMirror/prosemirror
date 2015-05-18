import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpNode} from "../cmp"

import {Pos} from "../../src/model"

const test = namespace("history")

function type(pm, text) { pm.apply(pm.tr.insertText(pm.selection.head, text)) }

function cut(pm) { pm.history.lastAddedAt = 0 }

function P(...args) { return new Pos(args, args.pop()) }

test("undo", pm => {
  type(pm, "a")
  type(pm, "b")
  cmpNode(pm.doc, doc(p("ab")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("redo", pm => {
  type(pm, "a")
  type(pm, "b")
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("ab")))
})

test("undo_multiple", pm => {
  type(pm, "a")
  cut(pm)
  type(pm, "b")
  cmpNode(pm.doc, doc(p("ab")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("a")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("a")))
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("ab")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("a")))
})

test("unsynced", pm => {
  type(pm, "hello")
  pm.apply(pm.tr.insertText(P(0, 0), "oops"), {addToHistory: false})
  pm.apply(pm.tr.insertText(P(0, 9), "!"), {addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("oops!")))
})

test("unsynced_complex", pm => {
  type(pm, "hello")
  cut(pm)
  type(pm, "!")
  pm.apply(pm.tr.insertText(P(0, 0), "...."))
  pm.apply(pm.tr.split(P(0, 2)))
  cmpNode(pm.doc, doc(p(".."), p("..hello!")))
  pm.apply(pm.tr.split(P(0, 1)), {addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

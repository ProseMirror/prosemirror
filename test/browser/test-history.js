import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpNode, P} from "../cmp"

const test = namespace("history")

function type(pm, text) { pm.apply(pm.tr.insertText(pm.selection.head, text)) }

function cut(pm) { pm.history.lastAddedAt = 0 }

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

test("multiple", pm => {
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
  cmpNode(pm.doc, doc(p("."), p("...hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("."), p("...")))
})

test("overlapping", pm => {
  type(pm, "hello")
  cut(pm)
  pm.apply(pm.tr.delete(P(0, 0), P(0, 5)))
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("overlapping_no_collapse", pm => {
  pm.history.allowCollapsing = false
  type(pm, "hello")
  cut(pm)
  pm.apply(pm.tr.delete(P(0, 0), P(0, 5)))
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("overlapping_unsynced_delete", pm => {
  type(pm, "hi")
  cut(pm)
  type(pm, "hello")
  pm.apply(pm.tr.delete(P(0, 0), P(0, 7)), {addToHistory: false})
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("ping_pong", pm => {
  type(pm, "one")
  type(pm, " two")
  cut(pm)
  type(pm, " three")
  pm.apply(pm.tr.insertText(P(0, 0), "zero "))
  cut(pm)
  pm.apply(pm.tr.split(P(0, 0)))
  pm.setSelection(P(0, 0))
  type(pm, "top")
  for (let i = 0; i < 6; i++) {
    let re = i % 2
    for (let j = 0; j < 4; j++)
      cmp(pm.history[re ? "redo" : "undo"](), j < 3)
    cmpNode(pm.doc, re ? doc(p("top"), p("zero one two three")) : doc(p()))
  }
})

test("ping_pong_unsynced", pm => {
  type(pm, "one")
  type(pm, " two")
  cut(pm)
  pm.apply(pm.tr.insertText(pm.selection.head, "xxx"), {addToHistory: false})
  type(pm, " three")
  pm.apply(pm.tr.insertText(P(0, 0), "zero "))
  cut(pm)
  pm.apply(pm.tr.split(P(0, 0)))
  pm.setSelection(P(0, 0))
  type(pm, "top")
  pm.apply(pm.tr.insertText(P(0, 0), "yyy"), {addToHistory: false})
  pm.apply(pm.tr.insertText(P(0, 6), "zzz"), {addToHistory: false})
  for (let i = 0; i < 6; i++) {
    let re = i % 2
    for (let j = 0; j < 4; j++)
      cmp(pm.history[re ? "redo" : "undo"](), j < 3)
    cmpNode(pm.doc, re ? doc(p("yyytopzzz"), p("zero one twoxxx three")) : doc(p("yyyzzz"), p("xxx")))
  }
})

test("compressable", pm => {
  type(pm, "XY")
  pm.setSelection(P(0, 1))
  cut(pm)
  type(pm, "one")
  type(pm, "two")
  type(pm, "three")
  pm.apply(pm.tr.insertText(P(0, 13), "!"), {addToHistory: false})
  pm.history.done.compress(pm.doc) // FIXME
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("XY!")))
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
})

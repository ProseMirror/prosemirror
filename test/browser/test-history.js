import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpNode, P} from "../cmp"

const test = namespace("history")

function type(pm, text) { pm.tr.insertText(pm.selection.head, text).apply() }

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
  pm.tr.insertText(P(0, 0), "oops").apply({addToHistory: false})
  pm.tr.insertText(P(0, 9), "!").apply({addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("oops!")))
})

test("unsynced_complex", pm => {
  type(pm, "hello")
  cut(pm)
  type(pm, "!")
  pm.tr.insertText(P(0, 0), "....").apply()
  pm.tr.split(P(0, 2)).apply()
  cmpNode(pm.doc, doc(p(".."), p("..hello!")))
  pm.tr.split(P(0, 1)).apply({addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("."), p("...hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("."), p("...")))
})

test("overlapping", pm => {
  type(pm, "hello")
  cut(pm)
  pm.tr.delete(P(0, 0), P(0, 5)).apply()
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
  pm.tr.delete(P(0, 0), P(0, 5)).apply()
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
  pm.tr.delete(P(0, 0), P(0, 7)).apply({addToHistory: false})
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("ping_pong", pm => {
  type(pm, "one")
  type(pm, " two")
  cut(pm)
  type(pm, " three")
  pm.tr.insertText(P(0, 0), "zero ").apply()
  cut(pm)
  pm.tr.split(P(0, 0)).apply()
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
  pm.tr.insertText(pm.selection.head, "xxx").apply({addToHistory: false})
  type(pm, " three")
  pm.tr.insertText(P(0, 0), "zero ").apply()
  cut(pm)
  pm.tr.split(P(0, 0)).apply()
  pm.setSelection(P(0, 0))
  type(pm, "top")
  pm.tr.insertText(P(0, 0), "yyy").apply({addToHistory: false})
  pm.tr.insertText(P(0, 6), "zzz").apply({addToHistory: false})
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
  pm.tr.insertText(P(0, 13), "!").apply({addToHistory: false})
  pm.history.done.startCompression(pm.doc)
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("XY!")))
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
})

test("setDocResets", pm => {
  type(pm, "hello")
  pm.setDoc(doc(p("aah")))
  cmp(pm.history.undo(), false)
  cmpNode(pm.doc, doc(p("aah")))
}, {doc: doc(p("okay"))})

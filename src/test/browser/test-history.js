import {namespace} from "./def"
import {doc, p} from "../build"
import {is, cmp, cmpStr, cmpNode} from "../cmp"

const test = namespace("history")

function type(pm, text) { pm.tr.insertText(pm.selection.head, text).apply() }

function cutHistory(pm) { pm.history.lastAddedAt = 0 }

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
  cutHistory(pm)
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
  pm.tr.insertText(1, "oops").apply({addToHistory: false})
  pm.tr.insertText(10, "!").apply({addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("oops!")))
})

test("unsynced_complex", pm => {
  type(pm, "hello")
  cutHistory(pm)
  type(pm, "!")
  pm.tr.insertText(1, "....").apply()
  pm.tr.split(3).apply()
  cmpNode(pm.doc, doc(p(".."), p("..hello!")))
  pm.tr.split(2).apply({addToHistory: false})
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("."), p("...hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("."), p("...")))
})

test("overlapping", pm => {
  type(pm, "hello")
  cutHistory(pm)
  pm.tr.delete(1, 6).apply()
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("overlapping_no_collapse", pm => {
  pm.history.allowCollapsing = false
  type(pm, "hello")
  cutHistory(pm)
  pm.tr.delete(1, 6).apply()
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("hello")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("overlapping_unsynced_delete", pm => {
  type(pm, "hi")
  cutHistory(pm)
  type(pm, "hello")
  pm.tr.delete(1, 8).apply({addToHistory: false})
  cmpNode(pm.doc, doc(p()))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p()))
})

test("ping_pong", pm => {
  type(pm, "one")
  type(pm, " two")
  cutHistory(pm)
  type(pm, " three")
  pm.tr.insertText(1, "zero ").apply()
  cutHistory(pm)
  pm.tr.split(1).apply()
  pm.setTextSelection(1)
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
  cutHistory(pm)
  pm.tr.insertText(pm.selection.head, "xxx").apply({addToHistory: false})
  type(pm, " three")
  pm.tr.insertText(1, "zero ").apply()
  cutHistory(pm)
  pm.tr.split(1).apply()
  pm.setTextSelection(1)
  type(pm, "top")
  pm.tr.insertText(1, "yyy").apply({addToHistory: false})
  pm.tr.insertText(7, "zzz").apply({addToHistory: false})
  for (let i = 0; i < 6; i++) {
    let re = i % 2
    for (let j = 0; j < 4; j++)
      cmp(pm.history[re ? "redo" : "undo"](), j < 3)
    cmpNode(pm.doc, re ? doc(p("yyytopzzz"), p("zero one twoxxx three")) : doc(p("yyyzzz"), p("xxx")))
  }
})

test("compressable", pm => {
  type(pm, "XY")
  pm.setTextSelection(2)
  cutHistory(pm)
  type(pm, "one")
  type(pm, "two")
  type(pm, "three")
  pm.tr.insertText(14, "!").apply({addToHistory: false})
  pm.history.done.startCompression(pm.doc)
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
  pm.execCommand("undo")
  cmpNode(pm.doc, doc(p("XY!")))
  cmpStr(pm.selection.anchor, 2)
  pm.execCommand("redo")
  cmpNode(pm.doc, doc(p("XonetwothreeY!")))
  cmpStr(pm.selection.anchor, 13)
})

test("setDocResets", pm => {
  type(pm, "hello")
  pm.setDoc(doc(p("aah")))
  cmp(pm.history.undo(), false)
  cmpNode(pm.doc, doc(p("aah")))
}, {doc: doc(p("okay"))})

test("isAtVersion", pm => {
  type(pm, "hello")
  cutHistory(pm)
  let version = pm.history.getVersion()
  type(pm, "ok")
  is(!pm.history.isAtVersion(version), "ahead")
  pm.history.undo()
  is(pm.history.isAtVersion(version), "went back")
  pm.history.undo()
  is(!pm.history.isAtVersion(version), "behind")
  pm.history.redo()
  is(pm.history.isAtVersion(version), "went forward")
})

test("rollback", pm => {
  type(pm, "hello")
  let version = pm.history.getVersion()
  type(pm, "ok")
  cutHistory(pm)
  type(pm, "more")
  is(pm.history.backToVersion(version), "rollback")
  cmpNode(pm.doc, doc(p("hello")), "back to start")
  is(pm.history.backToVersion(version), "no-op rollback")
  cmpNode(pm.doc, doc(p("hello")), "no-op had no effect")
  pm.history.undo()
  is(!pm.history.backToVersion(version), "failed rollback")
})

test("setSelectionOnUndo", pm => {
  type(pm, "hi")
  cutHistory(pm)
  pm.setTextSelection(1, 3)
  let selection = pm.selection
  pm.tr.replaceWith(selection.from, selection.to, pm.schema.text("hello")).apply()
  let selection2 = pm.selection
  pm.execCommand("undo")
  is(pm.selection.eq(selection), "failed restoring selection after undo")
  pm.execCommand("redo")
  is(pm.selection.eq(selection2), "failed restoring selection after redo")
})


test("rebaseSelectionOnUndo", pm => {
  type(pm, "hi")
  cutHistory(pm)
  pm.setTextSelection(1, 3)
  pm.tr.insert(1, pm.schema.text("hello")).apply()
  pm.tr.insert(1, pm.schema.text("---")).apply({addToHistory: false})
  pm.execCommand("undo")
  cmpStr(pm.selection.head, 6)
})

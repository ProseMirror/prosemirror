import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpStr, P} from "../cmp"

const test = namespace("ranges", {doc: doc(p("hello"))})

test("preserve", pm => {
  let range = pm.markRange(P(0, 1), P(0, 4))
  cmpStr(range.from, P(0, 1))
  cmpStr(range.to, P(0, 4))
  pm.tr.insertText(P(0, 0), "A").insertText(P(0, 1), "B").apply()
  cmpStr(range.from, P(0, 3))
  cmpStr(range.to, P(0, 6))
  pm.tr.delete(P(0, 4), P(0, 5)).apply()
  cmpStr(range.from, P(0, 3))
  cmpStr(range.to, P(0, 5))
})

test("leftInclusive", pm => {
  let range1 = pm.markRange(P(0, 1), P(0, 2), {inclusiveLeft: true})
  let range2 = pm.markRange(P(0, 1), P(0, 2), {inclusiveLeft: false})
  pm.tr.insertText(P(0, 1), "X").apply()
  cmpStr(range1.from, P(0, 1))
  cmpStr(range2.from, P(0, 2))
})

test("rightInclusive", pm => {
  let range1 = pm.markRange(P(0, 1), P(0, 2), {inclusiveRight: true})
  let range2 = pm.markRange(P(0, 1), P(0, 2), {inclusiveRight: false})
  pm.tr.insertText(P(0, 2), "X").apply()
  cmpStr(range1.to, P(0, 3))
  cmpStr(range2.to, P(0, 2))
})

test("deleted", pm => {
  let range = pm.markRange(P(0, 1), P(0, 2)), cleared = false
  range.on("removed", () => cleared = true)
  pm.tr.insertText(P(0, 1), "A").apply()
  cmp(cleared, false)
  pm.tr.delete(P(0, 2), P(0, 4)).apply()
  cmp(cleared, true)
  cmp(range.from, null)
})

test("cleared", pm => {
  let range = pm.markRange(P(0, 1), P(0, 2)), cleared = false
  range.on("removed", () => cleared = true)
  pm.removeRange(range)
  cmp(cleared, true)
  cmp(range.from, null)
})

test("stay_when_empty", pm => {
  let range = pm.markRange(P(0, 1), P(0, 2), {clearWhenEmpty: false}), cleared = false
  range.on("removed", () => cleared = true)
  pm.tr.delete(P(0, 0), P(0, 4)).apply()
  cmp(cleared, false)
  cmpStr(range.from, P(0, 0))
  cmpStr(range.to, P(0, 0))
})

test("add_class", pm => {
  let range = pm.markRange(P(0, 1), P(0, 4), {className: "foo"})
  pm.flush()
  cmp(pm.content.querySelector(".foo").textContent, "ell")
  pm.removeRange(range)
  pm.flush()
  cmp(pm.content.querySelector(".foo"), null)
})


test("add_class_multi_block", pm => {
  let range = pm.markRange(P(0, 1), P(1, 1, 0, 4), {className: "foo"})
  pm.flush()
  let found = pm.content.querySelectorAll(".foo")
  cmp(found.length, 3)
  cmp(found[0].textContent, "ne")
  cmp(found[1].textContent, "two")
  cmp(found[2].textContent, "thre")
  pm.removeRange(range)
  pm.flush()
  cmp(pm.content.querySelector(".foo"), null)
}, {doc: doc(p("one"), ul(li(p("two")), li(p("three"))))})

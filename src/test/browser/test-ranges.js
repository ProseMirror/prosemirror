const {namespace} = require("./def")
const {doc, p, li, ul, hr, blockquote} = require("../build")
const {cmp, cmpStr} = require("../cmp")

const test = namespace("ranges", {doc: doc(p("hello"))})

test("preserve", pm => {
  let range = pm.markRange(2, 5)
  cmpStr(range.from, 2)
  cmpStr(range.to, 5)
  pm.tr.insertText(1, "A").insertText(2, "B").apply()
  cmpStr(range.from, 4)
  cmpStr(range.to, 7)
  pm.tr.delete(5, 6).apply()
  cmpStr(range.from, 4)
  cmpStr(range.to, 6)
})

test("leftInclusive", pm => {
  let range1 = pm.markRange(2, 3, {inclusiveLeft: true})
  let range2 = pm.markRange(2, 3, {inclusiveLeft: false})
  pm.tr.insertText(2, "X").apply()
  cmpStr(range1.from, 2)
  cmpStr(range2.from, 3)
})

test("rightInclusive", pm => {
  let range1 = pm.markRange(2, 3, {inclusiveRight: true})
  let range2 = pm.markRange(2, 3, {inclusiveRight: false})
  pm.tr.insertText(3, "X").apply()
  cmpStr(range1.to, 4)
  cmpStr(range2.to, 3)
})

test("deleted", pm => {
  let cleared = false, range = pm.markRange(2, 3, {
    onRemove: () => cleared = true
  })
  pm.tr.insertText(2, "A").apply()
  cmp(cleared, false)
  pm.tr.delete(3, 5).apply()
  cmp(cleared, true)
  cmp(range.from, null)
})

test("cleared", pm => {
  let cleared = false, range = pm.markRange(2, 3, {
    onRemove: () => cleared = true
  })
  pm.removeRange(range)
  cmp(cleared, true)
  cmp(range.from, null)
})

test("stay_when_empty", pm => {
  let cleared = false, range = pm.markRange(2, 3, {
    removeWhenEmpty: false,
    onRemove: () => cleared = true
  })
  pm.tr.delete(1, 5).apply()
  cmp(cleared, false)
  cmpStr(range.from, 1)
  cmpStr(range.to, 1)
})

test("add_class_simple", pm => {
  let range = pm.markRange(2, 5, {className: "foo"})
  pm.flush()
  cmp(pm.content.querySelector(".foo").textContent, "ell")
  pm.removeRange(range)
  pm.flush()
  cmp(pm.content.querySelector(".foo"), null)
})

test("add_class_messy", pm => {
  let big = doc(hr, blockquote(p(), hr, ul(li(p("a"))), p("h<a>ello")), p("y<b>ou"))
  pm.setDoc(big)
  pm.markRange(big.tag.a, big.tag.b, {className: "foo"})
  pm.flush()
  let foos = pm.content.querySelectorAll(".foo")
  cmp(foos.length, 2)
  cmpStr(foos[0].textContent, "ello")
  cmpStr(foos[1].textContent, "y")
})

test("add_class_multi_block", pm => {
  let range = pm.markRange(2, 19, {className: "foo"})
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

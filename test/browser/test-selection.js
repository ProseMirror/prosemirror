import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, img, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpNode, gt, cmpStr, P} from "../cmp"

import {Pos} from "../../src/model"

function allPositions(doc, block) {
  let found = [], path = []
  function scan(node) {
    let p = path.slice()
    if (node.isTextblock) {
      let size = node.maxOffset
      for (let i = 0; i <= size; i++) found.push(new Pos(p, i))
    } else if (node.type.contains) {
      for (let i = 0;; i++) {
        if (!block) found.push(new Pos(p, i))
        if (i == node.length) break
        path.push(i)
        scan(node.child(i))
        path.pop()
      }
    }
  }
  scan(doc)
  return found
}

const test = namespace("selection")

export function findTextNode(node, text) {
  if (node.nodeType == 3) {
    if (node.nodeValue == text) return node
  } else if (node.nodeType == 1) {
    for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
      let found = findTextNode(ch, text)
      if (found) return found
    }
  }
}

function setSel(node, offset) {
  let range = document.createRange()
  range.setEnd(node, offset)
  range.setStart(node, offset)
  let sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

test("read", pm => {
  function test(node, offset, expected, comment) {
    setSel(node, offset)
    pm.sel.pollForUpdate()
    cmpStr(pm.selection.head, expected, comment)
    pm.flush()
  }
  let one = findTextNode(pm.content, "one")
  let two = findTextNode(pm.content, "two")
  test(one, 0, P(0, 0), "force 0:0")
  test(one, 1, P(0, 1), "force 0:1")
  test(one, 3, P(0, 3), "force 0:3")
  test(one.parentNode, 0, P(0, 0), "force :0 from one")
  test(one.parentNode, 1, P(0, 3), "force :1 from one")
  test(two, 0, P(2, 0, 0), "force 1:0")
  test(two, 3, P(2, 0, 3), "force 1:3")
  test(two.parentNode, 1, P(2, 0, 3), "force :1 from two")
  test(pm.content, 1, undefined, "force :1")
  test(pm.content, 2, P(2, 0, 0), "force :2")
  test(pm.content, 3, P(2, 0, 3), "force :3")
}, {
  doc: doc(p("one"), hr, blockquote(p("two")))
})

function getSel() {
  let sel = window.getSelection()
  let node = sel.focusNode, offset = sel.focusOffset
  while (node && node.nodeType != 3) {
    let after = offset < node.childNodes.length && node.childNodes[offset]
    let before = offset > 0 && node.childNodes[offset - 1]
    if (after) { node = after; offset = 0 }
    else if (before) { node = before; offset = node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length }
    else break
  }
  return {node: node, offset: offset}
}

test("set", pm => {
  function test(pos, node, offset) {
    pm.setSelection(pos)
    pm.flush()
    let sel = getSel()
    cmp(sel.node, node, pos)
    cmp(sel.offset, offset, pos)
  }
  let one = findTextNode(pm.content, "one")
  let two = findTextNode(pm.content, "two")
  pm.focus()
  test(P(0, 0), one, 0)
  test(P(0, 1), one, 1)
  test(P(0, 3), one, 3)
  test(P(2, 0, 0), two, 0)
  test(P(2, 0, 2), two, 2)
}, {
  doc: doc(p("one"), hr, blockquote(p("two")))
})

test("change_event", pm => {
  let received = 0
  pm.on("selectionChange", () => ++received)
  pm.setSelection(P(0, 1))
  pm.setSelection(P(0, 1))
  cmp(received, 1, "changed")
  pm.setSelection(P(0, 0))
  cmp(received, 2, "changed back")
  pm.setOption("doc", doc(p("hi")))
  cmp(received, 2, "new doc")
  pm.tr.insertText(P(0, 2), "you").apply()
  cmp(received, 3, "doc changed")
}, {doc: doc(p("one"))})

test("coords_order", pm => {
  let p00 = pm.coordsAtPos(P(0, 0))
  let p01 = pm.coordsAtPos(P(0, 1))
  let p03 = pm.coordsAtPos(P(0, 3))
  let p10 = pm.coordsAtPos(P(1, 0))
  let p13 = pm.coordsAtPos(P(1, 3))

  gt(p00.bottom, p00.top)
  gt(p13.bottom, p13.top)

  cmp(p00.top, p01.top)
  cmp(p01.top, p03.top)
  cmp(p00.bottom, p03.bottom)
  cmp(p10.top, p13.top)

  gt(p01.left, p00.left)
  gt(p03.left, p01.left)
  gt(p10.top, p00.top)
  gt(p13.left, p10.left)
}, {
  doc: doc(p("one"), p("two"))
})

test("coords_cornercases", pm => {
  pm.markRange(P(0, 1), P(0, 4), {className: "foo"})
  pm.markRange(P(0, 6), P(0, 12), {className: "foo"})
  let positions = allPositions(pm.doc, true)
  for (let i = 0; i < positions.length; i++) {
    let coords = pm.coordsAtPos(positions[i])
    let pos = pm.posAtCoords(coords)
    cmpStr(pos, positions[i])
    pm.setSelection(pos)
    pm.flush()
  }
}, {
  doc: doc(p("one", em("two", strong("three"), img), br, code("foo")), p())
})

test("coords_round_trip", pm => {
  [P(0, 0), P(0, 1), P(0, 3), P(1, 0, 0), P(1, 1, 2), P(1, 1, 3)].forEach(pos => {
    let coords = pm.coordsAtPos(pos)
    let found = pm.posAtCoords(coords)
    cmpStr(found, pos)
  })
}, {
  doc: doc(p("one"), blockquote(p("two"), p("three")))
})

test("follow_change", pm => {
  pm.tr.insertText(P(0, 0), "xy").apply()
  cmpStr(pm.selection.head, P(0, 2))
  cmpStr(pm.selection.anchor, P(0, 2))
  pm.tr.insertText(P(0, 0), "zq").apply()
  cmpStr(pm.selection.head, P(0, 4))
  cmpStr(pm.selection.anchor, P(0, 4))
  pm.tr.insertText(P(0, 6), "uv").apply()
  cmpStr(pm.selection.head, P(0, 4))
  cmpStr(pm.selection.anchor, P(0, 4))
}, {
  doc: doc(p("hi"))
})

test("replace_with_block", pm => {
  pm.setSelection(P(0, 3))
  pm.tr.replaceSelection(pm.schema.node("horizontal_rule")).apply()
  cmpNode(pm.doc, doc(p("foo"), hr, p("bar")), "split paragraph")
  cmpStr(pm.selection.head, P(2, 0), "moved after rule")
  pm.setSelection(P(2, 3))
  pm.tr.replaceSelection(pm.schema.node("horizontal_rule")).apply()
  cmpNode(pm.doc, doc(p("foo"), hr, p("bar"), hr), "inserted after")
  cmpStr(pm.selection.head, P(2, 3), "stayed in paragraph")
}, {
  doc: doc(p("foobar"))
})

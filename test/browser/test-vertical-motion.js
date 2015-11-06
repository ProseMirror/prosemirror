import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, img, strong, code, a, a2, br, hr} from "../build"
import {cmpStr, P} from "../cmp"
import {moveVertically} from "../../src/edit/selection"

const test = namespace("vertical-motion")

function testMotion(name, doc, positions, dir) {
  test(name, pm => {
    for (let i = 0; i < positions.length; i += 2) {
      let from = positions[i], to = positions[i + 1]
      let result = moveVertically(pm, from, dir)
      cmpStr(result.pos, to, (dir > 0 ? "down" : "up") + " from " + from)
    }
  }, {doc})
}

function down(name, doc, ...positions) { testMotion(name + "-up", doc, positions, 1) }
function up(name, doc, ...positions) { testMotion(name + "-down", doc, positions, -1) }

function countLines(node) {
  let box = node.getBoundingClientRect()
  let lines = 0, y = box.top, boxes = node.firstChild.getClientRects()
  for (let i = 0; i < boxes.length; i++) {
    let box = boxes[i]
    if (box.bottom > y) {
      ++lines
      y = box.bottom + 5
    }
  }
  return lines || 1
}

down("two-paragraphs", doc(p("mmmmm"), p("mmm")),
     P(0, 0), P(1, 0),
     P(0, 1), P(1, 1),
     P(0, 3), P(1, 3),
     P(0, 5), P(1, 3),
     P(1, 1), P(1, 3))

up("two-paragraphs", doc(p("mmm"), p("mmmmm")),
   P(1, 0), P(0, 0),
   P(1, 1), P(0, 1),
   P(1, 3), P(0, 3),
   P(1, 5), P(0, 3),
   P(0, 1), P(0, 0))

down("into-empty", doc(p("hi"), p()),
     P(0, 0), P(1, 0),
     P(0, 2), P(1, 0),
     P(1, 0), P(1, 0))

up("into-empty", doc(p(), p("hi")),
   P(1, 0), P(0, 0),
   P(1, 2), P(0, 0),
   P(0, 0), P(0, 0))

down("through-list", doc(p("xxx"), ul(li(p("xxx"), p("xxx")), li(p("xxxxx")), li(p("xxx"))), p("xxx")),
     P(0, 0), P(1, 0, 0, 0),
     P(0, 1), P(1, 0, 0, 0),
     P(1, 0, 0, 0), P(1, 0, 1, 0),
     P(1, 0, 0, 2), P(1, 0, 1, 2),
     P(1, 0, 1, 0), P(1, 1, 0, 0), 
     P(1, 0, 1, 2), P(1, 1, 0, 2),
     P(1, 1, 0, 0), P(1, 2, 0, 0),
     P(1, 1, 0, 5), P(1, 2, 0, 3),
     P(1, 2, 0, 3), P(2, 3))

up("through-list", doc(p("xxx"), ul(li(p("xxx"), p("xxx")), li(p("xxxxx")), li(p("xxx"))), p("xxx")),
   P(2, 0), P(1, 2, 0, 0),
   P(2, 1), P(1, 2, 0, 0),
   P(1, 2, 0, 0), P(1, 1, 0, 0),
   P(1, 2, 0, 3), P(1, 1, 0, 3),
   P(1, 1, 0, 0), P(1, 0, 1, 0),
   P(1, 1, 0, 2), P(1, 0, 1, 2), 
   P(1, 0, 1, 2), P(1, 0, 0, 2),
   P(1, 0, 1, 0), P(1, 0, 0, 0),
   P(1, 0, 0, 3), P(0, 3))

test("wrapped", pm => {
  pm.setSelection(P(0, 1))
  pm.execCommand("moveDown")
  cmpStr(pm.selection.head, P(1, 1), "moved into wrapped")
  let lines = countLines(pm.content.querySelector('p[pm-path="1"]'))
  for (let i = 1; i < lines; i++) {
    pm.execCommand("moveDown")
    cmpStr(pm.selection.head.shorten(), P(1), "still in wrapped paragraph " + i)
  }
  pm.execCommand("moveDown")
  cmpStr(pm.selection.head, P(2, 1), "out of wrapped")
  for (let i = 0; i < lines; i++) {
    pm.execCommand("moveUp")
    cmpStr(pm.selection.head.shorten(), P(1), "still in wrapped paragraph (up) " + i)
  }
  pm.execCommand("moveUp")
  cmpStr(pm.selection.head, P(0, 1), "back to start")
}, {doc: doc(p("xxx"), p(new Array(500).join("x ")), p("xxx"))})

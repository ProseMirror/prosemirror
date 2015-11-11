import "../../src/collab"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {defTest} from "../tests"
import {P, cmpNode} from "../cmp"
import {tempEditors} from "./def"

class DummyServer {
  constructor() {
    this.version = 0
    this.pms = []
  }

  attach(pm) {
    pm.mod.collab.on("mustSend", () => this.mustSend(pm))
    this.pms.push(pm)
  }

  mustSend(pm) {
    if (pm.mod.collab.frozen) return
    let toSend = pm.mod.collab.sendableSteps()
    this.send(pm, toSend.version, toSend.steps)
    pm.mod.collab.confirmSteps(toSend)
  }

  send(pm, version, steps) {
    this.version += steps.length
    for (let i = 0; i < this.pms.length; i++)
      if (this.pms[i] != pm) this.pms[i].mod.collab.receive(steps)
  }
}

// Kludge to prevent an editor from sending its changes for a moment
function delay(pm, f) {
  pm.mod.collab.frozen = true
  f()
  pm.mod.collab.frozen = false
  if (pm.mod.collab.hasSendableSteps())
    pm.mod.collab.signal("mustSend")
}

function test(name, f, options, n) {
  defTest("collab_" + name, () => {
    let server = new DummyServer
    let optArray = []
    for (let i = 0; i < (n || 2); i++) {
      let copy = {collab: {version: server.version}}
      for (var prop in options) copy[prop] = options[prop]
      optArray.push(copy)
    }
    let pms = tempEditors(optArray)
    pms.forEach(pm => server.attach(pm))
    f.apply(null, pms)
  })
}

function type(pm, text, pos) {
  pm.tr.insertText(pos || pm.selection.head, text).apply()
}

function cut(pm) { pm.history.lastAddedAt = 0 }

function conv(...args) {
  let d = args.pop()
  if (typeof d == "string") d = doc(p(d))
  args.forEach(pm => cmpNode(pm.doc, d))
}

test("converge_easy", (pm1, pm2) => {
  type(pm1, "hi")
  type(pm2, "ok", P(0, 2))
  type(pm1, "!", P(0, 4))
  type(pm2, "...", P(0, 0))
  conv(pm1, pm2, "...hiok!")
})

test("converge_rebased", (pm1, pm2) => {
  type(pm1, "hi")
  delay(pm1, () => {
    type(pm1, "A")
    type(pm2, "X")
    type(pm1, "B")
    type(pm2, "Y")
  })
  conv(pm1, pm2, "hiXYAB")
})

test("converge_three", (pm1, pm2, pm3) => {
  type(pm1, "A")
  type(pm2, "U")
  type(pm3, "X")
  type(pm1, "B")
  type(pm2, "V")
  type(pm3, "C")
  conv(pm1, pm2, pm3, "AUXBVC")
}, null, 3)

test("converge_three_rebased", (pm1, pm2, pm3) => {
  type(pm1, "A")
  delay(pm2, () => {
    type(pm2, "U")
    type(pm3, "X")
    type(pm1, "B")
    type(pm2, "V")
    type(pm3, "C")
  })
  conv(pm1, pm2, pm3, "AXBCUV")
}, null, 3)

test("undo", (pm1, pm2) => {
  type(pm1, "A")
  type(pm2, "B")
  type(pm1, "C")
  pm2.execCommand("undo")
  type(pm2, "D")
  type(pm1, "E")
  conv(pm1, pm2, "ACDE")
})

test("redo", (pm1, pm2) => {
  type(pm1, "A")
  type(pm2, "B")
  type(pm1, "C")
  pm2.execCommand("undo")
  pm2.execCommand("redo")
  type(pm2, "D")
  type(pm1, "E")
  conv(pm1, pm2, "ABCDE")
})

test("undo_deep", (pm1, pm2) => {
  pm1.setSelection(P(0, 5))
  pm2.setSelection(P(1, 3))
  type(pm1, "!")
  type(pm2, "!")
  cut(pm1)
  delay(pm1, () => {
    type(pm1, " ...")
    type(pm2, " ,,,")
  })
  cut(pm1)
  type(pm1, "*")
  type(pm2, "*")
  pm1.execCommand("undo")
  conv(pm1, pm2, doc(p("hello! ..."), p("bye! ,,,*")))
  pm1.execCommand("undo")
  pm1.execCommand("undo")
  conv(pm1, pm2, doc(p("hello"), p("bye! ,,,*")))
  pm1.execCommand("redo")
  pm1.execCommand("redo")
  pm1.execCommand("redo")
  conv(pm1, pm2, doc(p("hello! ...*"), p("bye! ,,,*")))
  pm1.execCommand("undo")
  pm1.execCommand("undo")
  conv(pm1, pm2, doc(p("hello!"), p("bye! ,,,*")))
  pm2.execCommand("undo")
  conv(pm1, pm2, doc(p("hello!"), p("bye")))
}, {doc: doc(p("hello"), p("bye"))})

test("undo_deleted_event", (pm1, pm2) => {
  type(pm1, "A", P(0, 5))
  delay(pm1, () => {
    type(pm1, "B", P(0, 3))
    type(pm1, "C", P(0, 4))
    type(pm1, "D", P(0, 0))
    pm2.apply(pm2.tr.delete(P(0, 1), P(0, 4)))
  })
  conv(pm1, pm2, "DhoA")
  pm1.execCommand("undo")
  conv(pm1, pm2, "ho")
}, {doc: doc(p("hello"))})

/* This is related to the TP_2 condition often referenced in OT
   literature -- if you insert at two points but then pull out the
   content between those points, are the inserts still ordered
   properly. Our algorithm does not guarantee this.

test("tp_2", (pm1, pm2, pm3) => {
  delay(pm1, () => {
    delay(pm3, () => {
      type(pm1, "x", P(0, 1))
      type(pm3, "y", P(0, 2))
      pm2.apply(pm2.tr.delete(P(0, 1), P(0, 2)))
    })
  })
  conv(pm1, pm2, pm3, doc(p("axyc")))
}, {doc: doc(p("abc"))}, 3)
*/

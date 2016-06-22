const {collabEditing} = require("../../collab")
const {historyPlugin} = require("../../history")

const {doc, p} = require("../build")
const {defTest} = require("../tests")
const {cmpNode, cmp} = require("../cmp")
const {tempEditors} = require("./def")

class DummyServer {
  constructor() {
    this.version = 0
    this.pms = []
  }

  attach(pm) {
    let mod = collabEditing.get(pm)
    mod.mustSend.add(() => this.mustSend(pm, mod.clientID))
    this.pms.push(pm)
  }

  mustSend(pm, clientID) {
    let mod = collabEditing.get(pm)
    if (mod.frozen) return
    let toSend = mod.sendableSteps()
    this.send(pm, toSend.version, toSend.steps, clientID)
  }

  send(_pm, _version, steps, clientID) {
    this.version += steps.length
    for (let i = 0; i < this.pms.length; i++)
      collabEditing.get(this.pms[i]).receive(steps, steps.map(() => clientID))
  }
}

// Kludge to prevent an editor from sending its changes for a moment
function delay(pm, f) {
  let mod = collabEditing.get(pm)
  mod.frozen = true
  f()
  mod.frozen = false
  if (mod.hasSendableSteps()) mod.mustSend.dispatch()
}

function test(name, f, options, n) {
  defTest("collab_" + name, () => {
    let server = new DummyServer
    let optArray = []
    for (let i = 0; i < (n || 2); i++) {
      let copy = {plugins: [historyPlugin]}
      for (var prop in options) copy[prop] = options[prop]
      copy.plugins = (copy.plugins || []).concat(collabEditing.config({version: server.version}))
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

function conv(...args) {
  let d = args.pop()
  if (typeof d == "string") d = doc(p(d))
  args.forEach(pm => cmpNode(pm.doc, d))
}

test("converge_easy", (pm1, pm2) => {
  type(pm1, "hi")
  type(pm2, "ok", 3)
  type(pm1, "!", 5)
  type(pm2, "...", 1)
  conv(pm1, pm2, "...hiok!")
}, {plugins: []})

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

test("undo_basic", (pm1, pm2) => {
  type(pm1, "A")
  type(pm2, "B")
  type(pm1, "C")
  pm2.history.undo()
  conv(pm1, pm2, "AC")
  type(pm2, "D")
  type(pm1, "E")
  conv(pm1, pm2, "ACDE")
})

test("redo_basic", (pm1, pm2) => {
  type(pm1, "A")
  type(pm2, "B")
  type(pm1, "C")
  pm2.history.undo()
  pm2.history.redo()
  type(pm2, "D")
  type(pm1, "E")
  conv(pm1, pm2, "ABCDE")
})

test("undo_deep", (pm1, pm2) => {
  pm1.setTextSelection(6)
  pm2.setTextSelection(11)
  type(pm1, "!")
  type(pm2, "!")
  pm1.history.cut()
  delay(pm1, () => {
    type(pm1, " ...")
    type(pm2, " ,,,")
  })
  pm1.history.cut()
  type(pm1, "*")
  type(pm2, "*")
  pm1.history.undo()
  conv(pm1, pm2, doc(p("hello! ..."), p("bye! ,,,*")))
  pm1.history.undo()
  pm1.history.undo()
  conv(pm1, pm2, doc(p("hello"), p("bye! ,,,*")))
  pm1.history.redo()
  pm1.history.redo()
  pm1.history.redo()
  conv(pm1, pm2, doc(p("hello! ...*"), p("bye! ,,,*")))
  pm1.history.undo()
  pm1.history.undo()
  conv(pm1, pm2, doc(p("hello!"), p("bye! ,,,*")))
  pm2.history.undo()
  conv(pm1, pm2, doc(p("hello!"), p("bye")))
}, {doc: doc(p("hello"), p("bye"))})

test("undo_deleted_event", (pm1, pm2) => {
  pm1.setTextSelection(6)
  type(pm1, "A")
  delay(pm1, () => {
    type(pm1, "B", 4)
    type(pm1, "C", 5)
    type(pm1, "D", 1)
    pm2.apply(pm2.tr.delete(2, 5))
  })
  conv(pm1, pm2, "DhoA")
  pm1.history.undo()
  conv(pm1, pm2, "ho")
  cmp(pm1.selection.head, 3)
}, {doc: doc(p("hello"))})

/* This is related to the TP_2 condition often referenced in OT
   literature -- if you insert at two points but then pull out the
   content between those points, are the inserts still ordered
   properly. Our algorithm does not guarantee this.

test("tp_2", (pm1, pm2, pm3) => {
  delay(pm1, () => {
    delay(pm3, () => {
      type(pm1, "x", 2)
      type(pm3, "y", 3)
      pm2.apply(pm2.tr.delete(2, 3))
    })
  })
  conv(pm1, pm2, pm3, doc(p("axyc")))
}, {doc: doc(p("abc"))}, 3)
*/

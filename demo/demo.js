import {ProseMirror} from "../src/edit/main"
import {Pos, Node, LinkStyle} from "../src/model"
import {fromDOM} from "../src/parse/dom"
import {defaultSchema as schema} from "../src/model"

import "../src/inputrules/autoinput"
import "../src/menu/tooltipmenu"
import "../src/menu/menubar"
import "../src/collab"

LinkStyle.attachCommand("insertLink", type => ({
  label: "Insert a link",
  run(pm, href, text, title) {
    // Could not get replaceSelection to take the style directly :(
    pm.setStyle(type, true, {href, title});
    pm.tr.replaceSelection(pm.schema.text(text)).apply({scrollIntoView: true});
    pm.setStyle(type, false);
  },
  params: [
    {name: "Target", type: "text"},
    {name: "Text", type: "text", default: ""},
    {name: "Title", type: "text", default: ""}
  ],
}))

let te = document.querySelector("#content")
te.style.display = "none"

let dummy = document.createElement("div")
dummy.innerHTML = te.value
let doc = fromDOM(schema, dummy)

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

function makeEditor(where, collab) {
  return new ProseMirror({
    place: document.querySelector(where),
    autoInput: true,
    tooltipMenu: {emptyBlockMenu: true},
    menuBar: {float: true},
    doc: doc,
    collab: collab
  })
}

window.pm = window.pm2 = null
function createCollab() {
  let server = new DummyServer
  pm = makeEditor(".left", {version: server.version})
  server.attach(pm)
  pm2 = makeEditor(".right", {version: server.version})
  server.attach(pm2)
}

let collab = document.location.hash != "#single"
let button = document.querySelector("#switch")
function choose(collab) {
  if (pm) { pm.wrapper.parentNode.removeChild(pm.wrapper); pm = null }
  if (pm2) { pm2.wrapper.parentNode.removeChild(pm2.wrapper); pm2 = null }

  if (collab) {
    createCollab()
    button.textContent = "try single editor"
    document.location.hash = "#collab"
  } else {    
    pm = makeEditor(".full", false)
    button.textContent = "try collaborative editor"
    document.location.hash = "#single"
  }
}
button.addEventListener("click", () => choose(collab = !collab))

choose(collab)

addEventListener("hashchange", () => {
  let newVal = document.location.hash != "#single"
  if (newVal != collab) choose(collab = newVal)
})

document.querySelector("#mark").addEventListener("mousedown", e => {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

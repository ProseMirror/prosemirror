import ProseMirror from "../src/edit/main"
import {Pos, Node, fromDOM, toDOM} from "../src/model"
import "../src/inputrules/autoinput"
import "../src/menu/inlinetooltip"
import "../src/menu/menu"
import "../src/collab/collab"

let te = document.querySelector("#content")
te.style.display = "none"

let dummy = document.createElement("div")
dummy.innerHTML = te.value
let doc = fromDOM(dummy)

class DummyServer {
  constructor() {
    this.version = 0
    this.channels = []
  }

  channel() {
    let server = this
    let ch = {
      listening: null,
      listen(f) { this.listening = f },
      send(version, steps, cb) { server.send(ch, version, steps, cb) }
    }
    this.channels.push(ch)
    return ch
  }

  send(channel, version, steps, callback) {
    if (version == this.version) {
      this.version += steps.length
      callback(null, true)
      for (let i = 0; i < this.channels.length; i++)
        if (this.channels[i] != channel) this.channels[i].listening(steps)
    } else {
      callback(null, false)
    }
  }
}

function makeEditor(where, collab) {
  return new ProseMirror({
    place: document.querySelector(where),
    autoInput: true,
    inlineTooltip: true,
    menu: {followCursor: true},
    doc: doc,
    collab: collab
  })
}

window.pm = window.pm2 = null
function createCollab() {
  let server = new DummyServer
  pm = makeEditor(".left", {channel: server.channel()})
  pm2 = makeEditor(".right", {channel: server.channel()})
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

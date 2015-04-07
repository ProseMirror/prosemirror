import ProseMirror from "../src/edit/main"
import {Node, fromDOM, toDOM} from "../src/model"
import "../src/inputrules/autoinput"
import "../src/menu/inlinetooltip"
import "../src/menu/menu"
import "../src/collab/collab"

let te = document.querySelector("#content")
te.style.display = "none"

let dummy = document.createElement("div")
dummy.innerHTML = te.value
let doc = fromDOM(dummy)

let channel = {
  editors: Object.create(null),

  register(id, editor) {
    this.editors[id] = editor
  },

  send(id, changes, callback) {
    for (let editorID in this.editors) {
      if (editorID != id)
        this.editors[editorID].receive(changes)
    }
    setTimeout(() => callback(), 20)
  }
}

function makeEditor(where) {
  return new ProseMirror({
    place: document.querySelector(where),
    autoInput: true,
    inlineTooltip: true,
    menu: {followCursor: true},
    doc: doc,
    collab: {channel: channel}
  })
}

let left = window.pm = makeEditor(".left")
let right = window.pm2 = makeEditor(".right")

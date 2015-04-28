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

let channel = {
  editors: [],
  version: 0,

  register(editor) {
    this.editors.push(editor)
  },

  send(self, version, changes, callback) {
    setTimeout(() => { // Artificial delay
      if (version == this.version) {
        this.version += changes.length
        callback(null, true)
        for (let i = 0; i < this.editors.length; i++)
          if (this.editors[i] != self) this.editors[i].receive(changes)
      } else {
        callback(null, false)
      }
    }, 1000)
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

/*left.apply({name: "replace", pos: new Pos([1], 0), end: new Pos([1], 20)})
right.apply({name: "replace", pos: new Pos([1], 10), text: "hi"})*/

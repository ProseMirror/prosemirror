import ProseMirror from "../src/edit/main"
import {Pos, Node, fromDOM, toDOM} from "../src/model"
import "../src/inputrules/autoinput"
import "../src/menu/inlinetooltip"
import "../src/menu/menu"
import "../src/collab/collab"
import {xorIDs, nullID} from "../src/collab/id"

let te = document.querySelector("#content")
te.style.display = "none"

let dummy = document.createElement("div")
dummy.innerHTML = te.value
let doc = fromDOM(dummy)

let channel = {
  editors: Object.create(null),

  register(id, editor) {
    this.editors[id] = {editor: editor, version: nullID}
  },

  send(id, changes, version, callback) {
    let source = this.editors[id]
    source.version = version
    for (let editorID in this.editors) {
      if (editorID != id) {
        let obj = this.editors[editorID]
        obj.version = obj.editor.receive(changes)
      }
    }
    setTimeout(() => {
      callback()
      this.maybeConfirm()
    }, 20)
  },

  maybeConfirm() {
    let version = null, same = true
    for (let id in this.editors) {
      let obj = this.editors[id]
      if (version == null) version = obj.version
      else if (version != obj.version) same = false
    }
    if (same) for (let id in this.editors)
      this.editors[id].editor.confirm(version)
  }
}

let clientID = 1;
function makeEditor(where) {
  return new ProseMirror({
    place: document.querySelector(where),
    autoInput: true,
    inlineTooltip: true,
    menu: {followCursor: true},
    doc: doc,
    collab: {channel: channel, clientID: String(clientID++)}
  })
}

let left = window.pm = makeEditor(".left")
let right = window.pm2 = makeEditor(".right")

/*left.apply({name: "replace", pos: new Pos([1], 0), end: new Pos([1], 20)})
right.apply({name: "replace", pos: new Pos([1], 10), text: "hi"})*/

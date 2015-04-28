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

function makeChannel() {
  return {
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
      }, 300)
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
  let collab = {channel: makeChannel()}
  pm = makeEditor(".left", collab)
  pm2 = makeEditor(".right", collab)
}
createCollab()

let collab = true
let button = document.querySelector("#switch")
button.addEventListener("click", () => {
  pm.wrapper.parentNode.removeChild(pm.wrapper)
  let text
  if (collab) {
    pm2.wrapper.parentNode.removeChild(pm2.wrapper)
    pm = makeEditor(".full", false)
    text = "try collaborative editor"
  } else {
    createCollab()
    text = "try single editor"
  }
  button.textContent = text
  collab = !collab
})

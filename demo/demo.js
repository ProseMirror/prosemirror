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

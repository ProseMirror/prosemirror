import ProseMirror from "../src/edit/main"
import {Node, fromDOM, toDOM} from "../src/model"
import "../src/inputrules/autoinput"
import "../src/menu/inlinetooltip"
import "../src/menu/menu"

import jsBeautify from "js-beautify"

let te = document.querySelector("#content")

let pm = window.pm = new ProseMirror({
  place: document.body,
  autoInput: true,
  inlineTooltip: true,
  menu: {followCursor: true}
});

fromHTML()

function toHTML() {
  let dummy = document.createElement("div")
  dummy.appendChild(toDOM(pm.doc, {document: document}))
  te.value = jsBeautify.html(dummy.innerHTML, {
    indent_size: 2,
    preserve_newlines: false
  })

  te.style.display = ""
  pm.wrapper.style.display = "none"
}

function fromHTML() {
  let dummy = document.createElement("div")
  dummy.innerHTML = te.value
  pm.update(fromDOM(dummy))

  te.style.display = "none"
  pm.wrapper.style.display = ""
  
}

document.querySelector("input[value=\"editor\"]").addEventListener("change", e => {
  if (e.target.checked) fromHTML()
})
document.querySelector("input[value=\"html\"]").addEventListener("change", e => {
  if (e.target.checked) toHTML()
})

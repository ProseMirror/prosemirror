var ProseMirror = require("../dist/edit/main").ProseMirror
require("../dist/inputrules/autoinput")
require("../dist/menu/tooltipmenu")
require("../dist/menu/menubar")

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  autoInput: true,
  tooltipMenu: {selectedBlockMenu: true},
  menuBar: {float: true},
  doc: document.querySelector("#content"),
  docFormat: "dom"
})

document.querySelector("#mark").addEventListener("mousedown", e => {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

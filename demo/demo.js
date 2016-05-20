var ProseMirror = require("../dist/edit").ProseMirror
var fromDOM = require("../dist/format").fromDOM
var schema = require("../dist/model").defaultSchema
require("../dist/inputrules/autoinput")
require("../dist/menu/tooltipmenu")
require("../dist/menu/menubar")

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  autoInput: true,
  tooltipMenu: {selectedBlockMenu: true},
  menuBar: {float: true},
  doc: fromDOM(schema, document.querySelector("#content"))
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

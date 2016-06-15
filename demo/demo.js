var ProseMirror = require("../src/edit").ProseMirror
var schema = require("../src/schema-basic").schema
var exampleSetup = require("../src/example-setup").exampleSetup

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: schema.parseDOM(document.querySelector("#content")),
  plugins: [exampleSetup.config({tooltipMenu: true})]
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

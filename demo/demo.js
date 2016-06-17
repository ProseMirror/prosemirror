const {ProseMirror} = require("../src/edit")
const {Schema} = require("../src/model")
const {schema} = require("../src/schema-basic")
const {exampleSetup} = require("../src/example-setup")
const {addTableNodes} = require("../src/schema-table")

const mySchema = new Schema({
  nodes: addTableNodes(schema.nodeSpec, "block+", "block"),
  marks: schema.markSpec
})

const pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: mySchema.parseDOM(document.querySelector("#content")),
  plugins: [exampleSetup.config({tooltipMenu: true})]
})

document.querySelector("#mark").addEventListener("mousedown", e => {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

const {Schema, DOMParser} = require("prosemirror-model")
const {EditorView, Decoration, DecorationSet} = require("prosemirror-view")
const {EditorState, TextSelection, Plugin} = require("prosemirror-state")
const {schema} = require("prosemirror-schema-basic")
const {addListNodes} = require("prosemirror-schema-list")
const {exampleSetup} = require("prosemirror-example-setup")

const demoSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks
})

class ParagraphView {
  constructor(node) {
    this.dom = this.contentDOM = document.createElement("p")
    if (node.content.size == 0) this.dom.classList.add("empty")
  }

  update(node) {
    if (node.type.name != "paragraph") return false
    if (node.content.size > 0) this.dom.classList.remove("empty")
    else this.dom.classList.add("empty")
    return true
  }
}
let state = EditorState.create({doc: DOMParser.fromSchema(demoSchema).parse(document.querySelector("#content")),
                                plugins: exampleSetup({schema: demoSchema})})

let view = window.view = new EditorView(document.querySelector(".full"), {state, nodeViews: {paragraph(node, v, g) { return new ParagraphView(node, v, g) }}})

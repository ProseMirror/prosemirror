const {Schema, DOMParser} = require("prosemirror-model")
const {EditorView} = require("prosemirror-view")
const {EditorState, TextSelection} = require("prosemirror-state")
const {schema} = require("prosemirror-schema-basic")
const {addListNodes} = require("prosemirror-schema-list")
const {exampleSetup} = require("prosemirror-example-setup")

const demoSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks
})

let state = EditorState.create({doc: DOMParser.fromSchema(demoSchema).parse(document.querySelector("#content")),
                                plugins: exampleSetup({schema: demoSchema})})

let view = window.view = new EditorView(document.querySelector(".full"), {state})

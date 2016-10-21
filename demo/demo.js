const {Schema, DOMParser} = require("./parent/model")
const {EditorState} = require("./parent/state")
const {schema} = require("./parent/schema-basic")
const {addListNodes} = require("./parent/schema-list")
const {addTableNodes} = require("./parent/schema-table")
const {MenuBarEditorView} = require("./parent/menu")
const {exampleSetup} = require("./parent/example-setup")

const demoSchema = new Schema({
  nodes: addListNodes(addTableNodes(schema.nodeSpec, "block+", "block"), "paragraph block*", "block"),
  marks: schema.markSpec
})

let state = EditorState.create({doc: DOMParser.fromSchema(demoSchema).parse(document.querySelector("#content")),
                                plugins: exampleSetup({schema: demoSchema})})

let view = window.view = new MenuBarEditorView(document.querySelector(".full"), {
  state,
  onAction: action => view.updateState(view.editor.state.applyAction(action))
})

import {Schema, DOMParser} from "prosemirror-model"
import {EditorView} from "prosemirror-view"
import {EditorState} from "prosemirror-state"
import {schema} from "prosemirror-schema-basic"
import {addListNodes} from "prosemirror-schema-list"
import {exampleSetup} from "prosemirror-example-setup"

const demoSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes as any, "paragraph block*", "block"),
  marks: schema.spec.marks
})

let state = EditorState.create({doc: DOMParser.fromSchema(demoSchema).parse(document.querySelector("#content")!),
                                plugins: exampleSetup({schema: demoSchema})})

;(window as any).view = new EditorView(document.querySelector(".full"), {state})

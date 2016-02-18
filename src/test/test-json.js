import {doc, blockquote, p, hr, li, ul, em, strong, a, img} from "./build"
import {cmpNode} from "./cmp"
import {defTest} from "./tests"

import {defaultSchema as schema} from "../model"
import {Transform, Step} from "../transform"

function node(name, doc) {
  defTest("json_node_" + name, () => cmpNode(schema.nodeFromJSON(doc.toJSON()), doc))
}

node("simple",
     doc(p("foo")))

node("marks",
     doc(p("foo", em("bar", strong("baz")), " ", a("x"))))

node("inline_leaf",
     doc(p("foo", em(img, "bar"))))

node("block_leaf",
     doc(p("a"), hr, p("b"), p()))

node("nesting",
     doc(blockquote(ul(li(p("a"), p("b")), li(p(img))), p("c")), p("d")))

export function testStepJSON(tr) {
  let newTR = new Transform(tr.before)
  tr.steps.forEach(step => newTR.step(Step.fromJSON(schema, step.toJSON())))
  cmpNode(tr.doc, newTR.doc)
}

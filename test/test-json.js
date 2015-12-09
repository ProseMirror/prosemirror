import {doc, blockquote, pre, pre2, h1, h2, p, hr, li, ol, ul, em, strong, code, a, br, img, dataImage} from "./build"
import {cmpNode, cmpStr} from "./cmp"
import {defTest} from "./tests"

import {defaultSchema as schema} from "../src/model"
import {Transform, Step} from "../src/transform"

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
  let json = tr.steps.map(s => s.toJSON())
  let newTR = new Transform(tr.before)
  tr.steps.forEach(step => newTR.step(Step.fromJSON(schema, step.toJSON())))
  cmpNode(tr.doc, newTR.doc)
}

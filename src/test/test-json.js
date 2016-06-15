const {doc, blockquote, p, hr, li, ul, em, strong, a, img} = require("./build")
const {cmpNode} = require("./cmp")
const {defTest} = require("./tests")

const {schema} = require("../schema-basic")

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

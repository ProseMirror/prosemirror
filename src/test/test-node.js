const {Fragment} = require("../model")
const {schema} = require("../schema-basic")

const {doc, blockquote, p, li, ul, em, strong, code, br, img} = require("./build")

const {Failure} = require("./failure")
const {defTest} = require("./tests")
const {cmpNode, cmpStr} = require("./cmp")

function str(name, node, str) {
  defTest("node_string_" + name, () => cmpStr(node, str))
}

str("nesting",
    doc(ul(li(p("hey"), p()), li(p("foo")))),
    'doc(bullet_list(list_item(paragraph("hey"), paragraph), list_item(paragraph("foo"))))')

str("inline_element",
    doc(p("foo", img, br, "bar")),
    'doc(paragraph("foo", image, hard_break, "bar"))')

str("marks",
    doc(p("foo", em("bar", strong("quux")), code("baz"))),
    'doc(paragraph("foo", em("bar"), em(strong("quux")), code("baz")))')

function cut(name, doc, cut) {
  defTest("node_cut_" + name, () => cmpNode(doc.cut(doc.tag.a || 0, doc.tag.b), cut))
}

cut("block",
    doc(p("foo"), "<a>", p("bar"), "<b>", p("baz")),
    doc(p("bar")))

cut("text",
    doc(p("0"), p("foo<a>bar<b>baz"), p("2")),
    doc(p("bar")))

cut("deep",
    doc(blockquote(ul(li(p("a"), p("b<a>c")), li(p("d")), "<b>", li(p("e"))), p("3"))),
    doc(blockquote(ul(li(p("c")), li(p("d"))))))

cut("left",
    doc(blockquote(p("foo<b>bar"))),
    doc(blockquote(p("foo"))))

cut("right",
    doc(blockquote(p("foo<a>bar"))),
    doc(blockquote(p("bar"))))

cut("inline",
    doc(p("foo", em("ba<a>r", img, strong("baz"), br), "qu<b>ux", code("xyz"))),
    doc(p(em("r", img, strong("baz"), br), "qu")))

function between(name, doc, ...nodes) {
  defTest("node_between_" + name, () => {
    let i = 0
    doc.nodesBetween(doc.tag.a, doc.tag.b, (node, pos) => {
      if (i == nodes.length)
        throw new Failure("More nodes iterated than listed (" + node.type.name + ")")
      let compare = node.isText ? node.text : node.type.name
      if (compare != nodes[i++])
        throw new Failure("Expected " + JSON.stringify(nodes[i - 1]) + ", got " + JSON.stringify(compare))
      if (!node.isText && doc.nodeAt(pos) != node)
        throw new Failure("Pos " + pos + " does not point at node " + node + " " + doc.nodeAt(pos))
    })
  })
}

between("text",
        doc(p("foo<a>bar<b>baz")),
        "paragraph", "foobarbaz")

between("deep",
        doc(blockquote(ul(li(p("f<a>oo")), p("b"), "<b>"), p("c"))),
        "blockquote", "bullet_list", "list_item", "paragraph", "foo", "paragraph", "b")

between("inline",
        doc(p(em("x"), "f<a>oo", em("bar", img, strong("baz"), br), "quux", code("xy<b>z"))),
        "paragraph", "foo", "bar", "image", "baz", "hard_break", "quux", "xyz")

function textContent(name, node, expect) {
  defTest("node_textContent_" + name, () => {
    cmpStr(node.textContent, expect)
  })
}

textContent("doc",
            doc(p("foo")),
            "foo")

textContent("text",
            schema.text("foo"),
            "foo")

function from(name, arg, expect) {
  defTest("node_fragment_from_" + name, () => {
    cmpNode(expect.copy(Fragment.from(arg)), expect)
  })
}

from("single",
     schema.node("paragraph"),
     doc(p()))

from("array",
     [schema.node("hard_break"), schema.text("foo")],
     p(br, "foo"))

from("fragment",
     doc(p("foo")).content,
     doc(p("foo")))

from("null",
     null,
     p())

from("append",
     [schema.text("a"), schema.text("b")],
     p("ab"))

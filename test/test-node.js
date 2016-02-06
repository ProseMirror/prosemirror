import {Fragment, defaultSchema as schema} from "../src/model"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, img, hr} from "./build"

import {Failure} from "./failure"
import {defTest} from "./tests"
import {is, cmp, cmpNode, cmpStr} from "./cmp"

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

function slice(name, doc, sliced) {
  defTest("node_slice_" + name, () => cmpNode(doc.sliceBetween(doc.tag.a, doc.tag.b), sliced))
}

slice("block",
      doc(p("foo"), "<a>", p("bar"), "<b>", p("baz")),
      doc(p("bar")))

slice("text",
      doc(p("0"), p("foo<a>bar<b>baz"), p("2")),
      doc(p("bar")))

slice("deep",
      doc(blockquote(ul(li(p("a"), p("b<a>c")), li(p("d")), "<b>", li(p("e"))), p("3"))),
      doc(blockquote(ul(li(p("c")), li(p("d"))))))

slice("left",
      doc(blockquote(p("foo<b>bar"))),
      doc(blockquote(p("foo"))))

slice("right",
      doc(blockquote(p("foo<a>bar"))),
      doc(blockquote(p("bar"))))

slice("inline",
      doc(p("foo", em("ba<a>r", img, strong("baz"), br), "qu<b>ux", code("xyz"))),
      doc(p(em("r", img, strong("baz"), br), "qu")))

function append(name, doc, result) {
  defTest("node_append_" + name, () => {
    let base = doc.path(doc.tag.to.path)
    let before = base.content.slice(0, doc.tag.to.offset)
    let after = doc.path(doc.tag.from.path).content.slice(doc.tag.from.offset)
    cmpNode(base.copy(before.append(after)), result.nodeAfter(result.tag.here))
  })
}

append("blocks",
       doc(blockquote(p("a"), "<to>", p("b")), blockquote("<from>", p("c"))),
       doc("<here>", blockquote(p("a"), p("c"))))

append("inline",
       doc(p("foo<to>bar"), p("baz<from>quux")),
       doc("<here>", p("fooquux")))

append("inline_styled",
       doc(p(em(strong("foo<to>bar"))), p(code("baz<from>quux"))),
       doc("<here>", p(em(strong("foo")), code("quux"))))

function between(name, doc, ...nodes) {
  defTest("node_between_" + name, () => {
    let i = 0
    doc.nodesBetween(doc.tag.a, doc.tag.b, (node, path) => {
      if (i == nodes.length)
        throw new Failure("More nodes iterated than listed (" + node.type.name + ")")
      let compare = node.isText ? node.text : node.type.name
      if (compare != nodes[i++])
        throw new Failure("Expected " + JSON.stringify(nodes[i - 1]) + ", got " + JSON.stringify(compare))
      if (doc.path(path).type != node.type)
        throw new Failure("Path " + path.join("/") + " does not go to node " + compare)
    })
  })
}

between("text",
        doc(p("foo<a>bar<b>baz")),
        "doc", "paragraph", "bar")

between("deep",
        doc(blockquote(ul(li(p("f<a>oo")), p("b"), "<b>"), p("c"))),
        "doc", "blockquote", "bullet_list", "list_item", "paragraph", "oo", "paragraph", "b")

between("inline",
        doc(p("f<a>oo", em("bar", img, strong("baz"), br), "quux", code("xy<b>z"))),
        "doc", "paragraph", "oo", "bar", "image", "baz", "hard_break", "quux", "xy")

function testIter(iter, results) {
  for (let i = 0;; i += 2) {
    if (i == results.length) {
      if (iter.atEnd()) return
      throw new Failure("More iter results than expected")
    } else if (iter.atEnd()) {
      throw new Failure("Less iter results than expected")
    }
    let node = iter.next()
    let compare = node.isText ? node.text : node.type.name
    if (results[i] != compare)
      throw new Failure("Unexpected iter result: " + JSON.stringify(compare) + " instead of " + JSON.stringify(results[i]))
    if (results[i + 1] != iter.offset)
      throw new Failure("Unexpected iter offset: " + iter.offset + " instead of " + results[i + 1])
  }
}

function iter(name, doc, ...results) {
  defTest("node_iter_" + name, () => {
    let target = doc.path(doc.tag.a.path)
    testIter(target.iter(doc.tag.a.offset, doc.tag.b && doc.tag.b.offset), results)
  })
}

function riter(name, doc, ...results) {
  defTest("node_riter_" + name, () => {
    let target = doc.path(doc.tag.a.path)
    testIter(target.reverseIter(doc.tag.a.offset, doc.tag.b && doc.tag.b.offset), results)
  })
}

iter("block",
     doc("<a>", p("foo"), blockquote(p("bar"))),
     "paragraph", 1, "blockquote", 2)
riter("block",
      doc(p("foo"), blockquote(p("bar")), "<a>"),
      "blockquote", 1, "paragraph", 0)

iter("block_partial",
     doc(p("foo"), "<a>", p("bar"), h1("baz"), "<b>", p("quux")),
     "paragraph", 2, "heading", 3)
riter("block_partial",
      doc(p("foo"), "<b>", p("bar"), h1("baz"), "<a>", p("quux")),
      "heading", 2, "paragraph", 1)

iter("inline",
     doc(p("<a>foo", img, em("bar", strong("baz")), "quux")),
     "foo", 3, "image", 4, "bar", 7, "baz", 10, "quux", 14)
riter("inline",
      doc(p("foo", img, em("bar", strong("baz")), "quux<a>")),
      "quux", 10, "baz", 7, "bar", 4, "image", 3, "foo", 0)

iter("inline_partial",
     doc(p("foo", img, em("ba<a>r", img, strong("baz")), "qu<b>ux")),
     "r", 7, "image", 8, "baz", 11, "qu", 13)
riter("inline_partial",
      doc(p("fo<b>o", img, em("bar", strong("ba<a>z")), "quux")),
      "ba", 7, "bar", 4, "image", 3, "o", 2)

iter("inline_contained",
     doc(p("foo<a>bar<b>baz")),
     "bar", 6)
riter("inline_contained",
      doc(p("foo<b>bar<a>baz")),
      "bar", 3)

function from(name, arg, expect) {
  defTest("node_fragment_from_" + name, () => {
    let result = Fragment.from(arg), i = 0
    for (let it = result.iter(), cur; cur = it.next().value; i++) {
      if (i == expect.length) {i++; break}
      cmpNode(cur, expect[i], "child " + i)
    }
    is(i == expect.length, "same size")
  })
}

from("single",
     schema.node("paragraph"),
     [schema.node("paragraph")])

from("array",
     [schema.node("hard_break"), schema.text("foo")],
     [schema.node("hard_break"), schema.text("foo")])

from("fragment",
     doc(p("foo")).content,
     [schema.node("paragraph", null, [schema.text("foo")])])

from("null",
     null,
     [])

from("append",
     [schema.text("a"), schema.text("b")],
     [schema.text("ab")])

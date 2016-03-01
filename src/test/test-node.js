import {Fragment, defaultSchema as schema} from "../model"

import {doc, blockquote, h1, p, li, ul, em, strong, code, br, img} from "./build"

import {Failure} from "./failure"
import {defTest} from "./tests"
import {is, cmpNode, cmpStr} from "./cmp"

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
  defTest("node_slice_" + name, () => cmpNode(doc.slice(doc.tag.a, doc.tag.b), sliced))
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

function append(name, before, after, result) {
  defTest("node_append_" + name, () => {
    let left = before.content.slice(0, before.tag.a)
    let right = after.content.slice(after.tag.a)
    cmpNode(before.copy(left.append(right)), result)
  })
}

append("blocks",
       blockquote(p("a"), "<a>", p("b")), blockquote("<a>", p("c")),
       blockquote(p("a"), p("c")))

append("inline",
       p("foo<a>bar"), p("baz<a>quux"),
       p("fooquux"))

append("inline_styled",
       p(em(strong("foo<a>bar"))), p(code("baz<a>quux")),
       p(em(strong("foo")), code("quux")))

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

function testCursor(cur, r, results) {
  for (let i = 0;; i += 2) {
    let end = r ? cur.atStart : cur.atEnd
    if (i == results.length) {
      if (end) return
      throw new Failure("More cursor results than expected")
    } else if (end) {
      throw new Failure("Less cursor results than expected")
    }
    let node = r ? cur.prev() : cur.next()
    let compare = node.isText ? node.text : node.type.name
    if (results[i] != compare)
      throw new Failure("Unexpected cursor result: " + JSON.stringify(compare) + " instead of " + JSON.stringify(results[i]))
    if (results[i + 1] != cur.pos)
      throw new Failure("Unexpected cursor pos: " + cur.pos + " instead of " + results[i + 1])
  }
}

function cursor(name, node, ...results) {
  defTest("node_cursor_" + name, () => {
    testCursor(node.cursor(node.tag.a), false, results)
  })
}

function rCursor(name, node, ...results) {
  defTest("node_rcursor_" + name, () => {
    testCursor(node.cursor(node.tag.a), true, results)
  })
}

cursor("block",
       doc("<a>", p("foo"), blockquote(p("bar"))),
       "paragraph", 5, "blockquote", 12)
rCursor("block",
        doc(p("foo"), blockquote(p("bar")), "<a>"),
        "blockquote", 5, "paragraph", 0)

cursor("inline",
       p("fo<a>o", img, em("bar", strong("baz")), "quux"),
       "o", 3, "image", 4, "bar", 7, "baz", 10, "quux", 14)
rCursor("inline",
        p("foo", img, em("bar", strong("baz")), "qu<a>ux"),
        "qu", 10, "baz", 7, "bar", 4, "image", 3, "foo", 0)

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

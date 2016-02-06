import {replace} from "../src/transform/replace"
import {MovedRange} from "../src/transform/map"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "./build"

import {Failure} from "./failure"
import {defTest} from "./tests"
import {cmpNode, cmpStr, P} from "./cmp"

function test(name, doc, insert, expected, moved) {
  defTest("replace_inner_" + name, () => {
    let sliced = insert.sliceBetween(insert.tag.a, insert.tag.b)
    let repl
    for (let left = insert.tag.a, right = insert.tag.b, i = 0, node = sliced;; i++) {
      if (i == left.path.length || i == right.path.length || left.path[i] != right.path[i] ||
          insert.tag.root && i == insert.tag.root.path.length) {
        repl = {content: node.content, openLeft: left.path.length - i, openRight: right.path.length - i}
        break
      }
      node = node.child(left.path[i])
    }
    let result = replace(doc, doc.tag.a, doc.tag.b, doc.tag.root.path, repl)
    cmpNode(result.doc, expected)
    if (moved) cmpStr("\n" + result.moved.join("\n"), "\n" + moved.join("\n"))
  })
}

test("delete_join",
     doc(p("on<a>e"), "<root>", p("t<b>wo")),
     doc("<a><b>"),
     doc(p("onwo")),
     [new MovedRange(P(2), 0, new P(1)),
      new MovedRange(P(1, 1), 2, P(0, 2))])

test("merge_simple",
     doc(p("on<a>e"), "<root>", p("t<b>wo")),
     doc(p("xx<a>xx"), p("yy<b>yy")),
     doc(p("onxx"), p("yywo")),
     [new MovedRange(P(1, 1), 2, P(1, 2))])

test("not_open",
     doc(p("on<a>e"), "<root>", p("t<b>wo")),
     doc("<a>", p("x"), p("y"), "<b>"),
     doc(p("on"), p("x"), p("y"), p("wo")),
     [new MovedRange(P(2), 0, P(4)),
      new MovedRange(P(1, 1), 2, P(3, 0))])

test("replace_with_text",
     doc(p("on<a>e"), "<root>", p("t<b>wo")),
     doc("<root>", p("<a>H<b>")),
     doc(p("onHwo")),
     [new MovedRange(P(2), 0, P(1)),
      new MovedRange(P(1, 1), 2, P(0, 3))])

test("non_matching",
     doc(p("on<a>e"), "<root>", p("t<b>wo")),
     doc("<root>", h1("<a>H<b>")),
     doc(p("on"), h1("H"), p("wo")),
     [new MovedRange(P(2), 0, P(3)),
      new MovedRange(P(1, 1), 2, P(2, 0))])

test("deep",
     doc(blockquote(blockquote(p("on<a>e"), "<root>", p("t<b>wo")))),
     doc("<root>", p("<a>H<b>")),
     doc(blockquote(blockquote(p("onHwo")))),
     [new MovedRange(P(0, 0, 2), 0, P(0, 0, 1)),
      new MovedRange(P(0, 0, 1, 1), 2, P(0, 0, 0, 3))])

test("same_block",
     doc(p("a<a><root>bc<b>d")),
     doc(p("x<a>y<b>z")),
     doc(p("ayd")),
     [new MovedRange(P(0, 3), 1, P(0, 2))])

test("deep_lopsided",
     doc(blockquote("<root>", blockquote(p("on<a>e"), p("two"), "<b>", p("three")))),
     doc("<root>", blockquote(p("aa<a>aa"), p("bb"), p("cc"), "<b>", p("dd"))),
     doc(blockquote(blockquote(p("onaa"), p("bb"), p("cc"), p("three")))),
     [new MovedRange(P(0, 0, 2), 1, P(0, 0, 3))])

test("deep_lopsided_mismatched",
     doc(blockquote("<root>", blockquote(p("one"), "<a>", p("two"), p("th<b>ree")))),
     doc("<root>", blockquote(p("aa<a>aa"), p("bb"), p("cc"), "<b>", p("dd"))),
     doc(blockquote(blockquote(p("one"), p("aa"), p("bb"), p("cc"), p("ree")))),
     [new MovedRange(P(0, 0, 3), 0, P(0, 0, 5)),
      new MovedRange(P(0, 0, 2, 2), 3, P(0, 0, 4, 0))])

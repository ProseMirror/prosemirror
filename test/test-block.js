import {doc, blockquote, h1, p, li, ol, ul, em, a, br} from "./build"

import tests from "./tests"
import {testTransform} from "./cmp"

import {Node, Pos} from "../src/model"
import {splitAt, wrappableRange, liftableRange, describeTarget, describePos} from "../src/transform"

function t(op, name, doc, expect, params) {
  tests[op + "_" + name] = function() {
    if (!params) params = {}
    params.name = op
    if (op == "lift" && !params.pos) {
      params = liftableRange(doc, doc.tag.a, doc.tag.b || doc.tag.a)
    } else if (op == "wrap") {
      params = wrappableRange(doc, doc.tag.a, doc.tag.b || doc.tag.a, params.type, params.attrs, params.join)
    } else if (op == "split") {
      params = splitAt(doc, doc.tag.a, params.depth)
    } else {
      if (!params.pos) params.pos = doc.tag.a
      if (!params.end) params.end = doc.tag.b
    }
    testTransform(doc, expect, params)
  }
}

t("lift", "simple_between",
  doc(blockquote(p("<before>one"), p("<a>two"), p("<after>three"))),
  doc(blockquote(p("<before>one")), p("<a>two"), blockquote(p("<after>three"))))
t("lift", "simple_at_front",
  doc(blockquote(p("<a>two"), p("<after>three"))),
  doc(p("<a>two"), blockquote(p("<after>three"))))
t("lift", "simple_at_end",
  doc(blockquote(p("<before>one"), p("<a>two"))),
  doc(blockquote(p("<before>one")), p("<a>two")))
t("lift", "simple_alone",
  doc(blockquote(p("<a>t<in>wo"))),
  doc(p("<a>t<in>wo")))
t("lift", "multiple",
  doc(blockquote(blockquote(p("on<a>e"), p("tw<b>o")), p("three"))),
  doc(blockquote(p("on<a>e"), p("tw<b>o"), p("three"))))
t("lift", "multiple_lopsided",
  doc(p("start"), blockquote(blockquote(p("a"), p("<a>b")), p("<b>c"))),
  doc(p("start"), blockquote(p("a"), p("<a>b")), p("<b>c")))
t("lift", "deeper",
  doc(blockquote(blockquote(p("<1>one"), p("<a>two"), p("<3>three"), p("<b>four"), p("<5>five")))),
  doc(blockquote(blockquote(p("<1>one")), p("<a>two"), p("<3>three"), p("<b>four"), blockquote(p("<5>five")))))
t("lift", "from_list",
  doc(ul(li(p("one")), li(p("two<a>")), li(p("three")))),
  doc(ul(li(p("one"))), p("two<a>"), ul(li(p("three")))))
t("lift", "multiple_from_list",
  doc(ul(li(p("one<a>")), li(p("two<b>")), li(p("three<after>")))),
  doc(p("one<a>"), p("two<b>"), ul(li(p("three<after>")))))
t("lift", "multiple_from_list_with_two_items",
  doc(ul(li(p("one<a>"), p("<half>half")), li(p("two<b>")), li(p("three<after>")))),
  doc(p("one<a>"), p("<half>half"), p("two<b>"), ul(li(p("three<after>")))))

t("wrap", "simple",
  doc(p("one"), p("<a>two"), p("three")),
  doc(p("one"), blockquote(p("<a>two")), p("three")),
  {type: "blockquote"})
t("wrap", "two",
  doc(p("one<1>"), p("<a>two"), p("<b>three"), p("four<4>")),
  doc(p("one<1>"), blockquote(p("<a>two"), p("three")), p("four<4>")),
  {type: "blockquote"})
t("wrap", "list",
  doc(p("<a>one"), p("<b>two")),
  doc(ol(li(p("<a>one")), li(p("<b>two")))),
  {type: "ordered_list"})
t("wrap", "nested_list",
  doc(ol(li(p("<1>one")), li(p("<a>two"), p("<b>three")), li(p("<4>four")))),
  doc(ol(li(p("<1>one")), li(ol(li(p("<a>two")), li(p("<b>three")))), li(p("<4>four")))),
  {type: "ordered_list"})
t("wrap", "not_possible",
  doc(p("hi<a>")),
  doc(p("hi<a>")),
  {type: "horizontal_rule"})
t("wrap", "include_parent",
  doc(blockquote(p("<1>one"), p("two<a>")), p("three<b>")),
  doc(blockquote(blockquote(p("<1>one"), p("two<a>")), p("three<b>"))),
  {type: "blockquote"})
t("wrap", "bullet_list",
  doc(p("x"), p("yyyy<a>y"), p("z")),
  doc(p("x"), ul(li(p("yyyy<a>y"))), p("z")),
  {type: "bullet_list"})
t("wrap", "join_left",
  doc(ol(li(p("hi<1>"))), p("aye<a>"), p("oy<b>")),
  doc(ol(li(p("hi<1>")), li(p("aye<a>")), li(p("oy<b>")))),
  {type: "ordered_list", join: "left"})
t("wrap", "join_right",
  doc(p("aye<a>"), p("oy<b>"), ol(li(p("hi<1>")))),
  doc(ol(li(p("aye<a>")), li(p("oy<b>")), li(p("hi<1>")))),
  {type: "ordered_list", join: "right"})

t("split", "simple",
  doc(p("foo<a>bar")),
  doc(p("foo"), p("<a>bar")))
t("split", "before_and_after",
  doc(p("<1>a"), p("<2>foo<a>bar<3>"), p("<4>b")),
  doc(p("<1>a"), p("<2>foo"), p("<a>bar<3>"), p("<4>b")))
t("split", "deeper",
  doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
  doc(blockquote(blockquote(p("foo")), blockquote(p("<a>bar"))), p("after<1>")),
  {depth: 2})
t("split", "and_deeper",
  doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
  doc(blockquote(blockquote(p("foo"))), blockquote(blockquote(p("<a>bar"))), p("after<1>")),
  {depth: 3})
t("split", "at_end",
  doc(blockquote(p("hi<a>"))),
  doc(blockquote(p("hi"), p("<a>"))))
t("split", "at_start",
  doc(blockquote(p("<a>hi"))),
  doc(blockquote(p(), p("<a>hi"))))
t("split", "list_paragraph",
  doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
  doc(ol(li(p("one<1>")), li(p("two"), p("<a>three")), li(p("four<2>")))))
t("split", "list_item",
  doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
  doc(ol(li(p("one<1>")), li(p("two")), li(p("<a>three")), li(p("four<2>")))),
  {depth: 2})

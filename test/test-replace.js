import {Node} from "../src/model"
import {insertText, insertNode, removeNode, joinNodes, splitAt,
        remove, replace} from "../src/transform"

import {doc, h1, blockquote, p, li, ol, ul, em, a, br} from "./build"

import Failure from "./failure"
import tests from "./tests"
import {testTransform} from "./cmp"

function t(name, base, spec, expect) {
  tests["replace_" + name] = function() {
    let text = null
    let params
    if (spec == "~") {
      params = joinNodes(base, base.tag.a)
    } else if (typeof spec == "string") {
      params = insertText(base.tag.a, spec, {end: base.tag.b})
    } else if (typeof spec == "number") {
      params = splitAt(base, base.tag.a, {depth: spec})
    } else if (spec === false) {
      params = removeNode(base, base.tag.a.path)
    } else if (spec == null) {
      params = remove(base, base.tag.a, base.tag.b)
    } else if (spec.tag) {
      params = replace(base, base.tag.a, base.tag.b,
                       spec, spec.tag.a, spec.tag.b)
    } else {
      params = insertNode(base, base.tag.a, {node: spec})
    }
    testTransform(base, expect, params)
  }
}

t("simple",
  doc(p("he<before>llo<a> w<after>orld")),
  doc(p("<a> big<b>")),
  doc(p("he<before>llo big w<after>orld")))

t("insert_paragraph",
  doc(p("one<a>two")),
  doc(p("a<a>"), p("hello"), p("<b>b")),
  doc(p("one"), p("hello"), p("<a>two")))

t("overwrite_paragraph",
  doc(p("one<a>"), p("t<inside>wo"), p("<b>three<end>")),
  doc(p("a<a>"), p("TWO"), p("<b>b")),
  doc(p("one"), p("TWO"), p("<a>three<end>")))

t("stitch",
  doc(p("foo ", em("bar<a>baz"), "<b> quux")),
  doc(p("foo ", em("xy<a>zzy"), " foo<b>")),
  doc(p("foo ", em("barzzy"), " foo quux")))

t("break",
  doc(p("foo<a>b<inside>b<b>bar")),
  doc(p("<a>", br, "<b>")),
  doc(p("foo", br, "<inside>bar")))

t("cut_different_block",
  doc(h1("hell<a>o"), p("by<b>e")),
  null,
  doc(h1("helle")))

t("restore_list",
  doc(h1("hell<a>o"), p("by<b>e")),
  doc(ol(li(p("on<a>e")), li(p("tw<b>o")))),
  doc(h1("helle"), ol(li(p("twe")))))

t("in_empty_block",
  doc(p("a"), p("<a>"), p("b")),
  doc(p("x<a>y<b>z")),
  doc(p("a"), p("y<a>"), p("b")))

t("dont_shift_everything",
  doc(p("one<a>"), p("two"), p("three")),
  doc(p("outside<a>"), blockquote(p("inside<b>"))),
  doc(p("one"), blockquote(p("inside")), p("two"), p("three")))

t("del_selection",
  doc(p("some <a>te<b>xt")),
  null,
  doc(p("some <a><b>xt")))

t("insert_text",
  doc(p("a <a>b<b> c<after>")),
  "D",
  doc(p("a D<a><b> c<after>")))

t("text_across_paragraphs",
  doc(p("on<a>e"), p("t<b>wo"), p("three")),
  "abc",
  doc(p("onabc<a>wo"), p("three")))

t("lopsided",
  doc(blockquote(p("b<a>c"), p("d<b>e"), p("f"))),
  doc(blockquote(p("x<a>y")), p("z<b>")),
  doc(blockquote(p("by")), p("z<a><b>e"), blockquote(p("f"))))

t("deep_insert",
  doc(blockquote(blockquote(p("one"), p("tw<a>o"), p("t<b>hree<3>"), p("four<4>")))),
  doc(ol(li(p("hello<a>world")), li(p("bye"))), p("ne<b>xt")),
  doc(blockquote(blockquote(p("one"), p("twworld")), ol(li(p("bye"))), p("ne<a><b>hree<3>"), blockquote(p("four<4>")))))

t("text_inherit_style",
  doc(p(em("he<a>lo"))),
  "l",
  doc(p(em("hello"))))

t("text_simple",
  doc(p("hello<a>")),
  " world",
  doc(p("hello world<a>")))
t("text_simple_inside",
  doc(p("he<a>llo")),
  "j",
  doc(p("hej<a>llo")))
t("text_left_associative",
  doc(p(em("hello<a>"), " world<after>")),
  " big",
  doc(p(em("hello big"), " world<after>")))
t("text_paths",
  doc(p("<1>before"), p("<2>here<a>"), p("after<3>")),
  "!",
  doc(p("<1>before"), p("<2>here!<a>"), p("after<3>")))
t("text_at_start",
  doc(p("<a>one")),
  "two ",
  doc(p("two <a>one")))
t("text_after br",
  doc(p("hello", br, "<a>you")),
  "...",
  doc(p("hello", br, "...you")))
t("text_after_br_nojoin",
  doc(p("hello", br, em("<a>you"))),
  "...",
  doc(p("hello", br, "...<a>", em("you"))))
t("text_before_br",
  doc(p("<a>", br, "ok")),
  "ay",
  doc(p("ay", br, "ok")))

t("remove_block_simple",
  doc(p("<1>one"), p("<a>tw<2>o"), p("<3>three")),
  false,
  doc(p("<1>one"), p("<2><3>three")))
t("remove_block_only_child",
  doc(blockquote(p("<a>hi")), p("x")),
  false,
  doc(blockquote(), p("x")))
t("remove_block_outside_path",
  doc(blockquote(p("a"), p("b<a>")), p("c<1>")),
  false,
  doc(blockquote(p("a")), p("c<1>")))

t("insert_break",
  doc(p("hello<a>there")),
  new Node.Inline("hard_break"),
  doc(p("hello", br, "<a>there")))
t("insert_simple",
  doc(p("one"), "<a>", p("two<2>")),
  new Node("paragraph"),
  doc(p("one"), p(), p("<a>two<2>")))
t("insert_end_of_blockquote",
  doc(blockquote(p("he<before>y"), "<a>"), p("after<after>")),
  new Node("paragraph"),
  doc(blockquote(p("he<before>y"), p()), p("after<after>")))
t("insert_start_of_blockquote",
  doc(blockquote("<a>", p("he<1>y")), p("after<2>")),
  new Node("paragraph"),
  doc(blockquote(p(), p("<a>he<1>y")), p("after<2>")))

t("join_simple",
  doc(blockquote(p("<before>a")), blockquote(p("<a>b")), p("after<after>")),
  "~",
  doc(blockquote(p("<before>a"), p("<a>b")), p("after<after>")))
t("join_deeper",
  doc(blockquote(blockquote(p("a"), p("b<before>")), blockquote(p("<a>c"), p("d<after>")))),
  "~",
  doc(blockquote(blockquote(p("a"), p("b<before>"), p("<a>c"), p("d<after>")))))
t("join_lists",
  doc(ol(li(p("one")), li(p("two"))), ol(li(p("<a>three")))),
  "~",
  doc(ol(li(p("one")), li(p("two")), li(p("<a>three")))))
t("join_list_item",
  doc(ol(li(p("one")), li(p("two")), li(p("<a>three")))),
  "~",
  doc(ol(li(p("one")), li(p("two"), p("<a>three")))))

t("split_simple",
  doc(p("foo<a>bar")),
  1,
  doc(p("foo"), p("<a>bar")))
t("split_before_and_after",
  doc(p("<1>a"), p("<2>foo<a>bar<3>"), p("<4>b")),
  1,
  doc(p("<1>a"), p("<2>foo"), p("<a>bar<3>"), p("<4>b")))
t("split_deeper",
  doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
  2,
  doc(blockquote(blockquote(p("foo")), blockquote(p("<a>bar"))), p("after<1>")))
t("split_and_deeper",
  doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
  3,
  doc(blockquote(blockquote(p("foo"))), blockquote(blockquote(p("<a>bar"))), p("after<1>")))
t("split_at_end",
  doc(blockquote(p("hi<a>"))),
  1,
  doc(blockquote(p("hi"), p("<a>"))))
t("split_at_start",
  doc(blockquote(p("<a>hi"))),
  1,
  doc(blockquote(p(), p("<a>hi"))))
t("split_list_paragraph",
  doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
  1,
  doc(ol(li(p("one<1>")), li(p("two"), p("<a>three")), li(p("four<2>")))))
t("split_list_item",
  doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
  2,
  doc(ol(li(p("one<1>")), li(p("two")), li(p("<a>three")), li(p("four<2>")))))

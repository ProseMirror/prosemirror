import {inline, style, Node, Pos} from "../src/model"
import {addStyle, removeStyle, setBlockType} from "../src/transform"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import {defTest} from "./tests"
import {testTransform} from "./cmp"

function t(op, name, doc, expect, params) {
  defTest(op + "_" + name, () => {
    if (op == "setType")
      params = setBlockType(doc.tag.a, doc.tag.b || doc.tag.a, params.type, params.attrs)
    else
      params = (op == "addStyle" ? addStyle : removeStyle)(doc.tag.a, doc.tag.b, params.style)
    testTransform(doc, expect, params)
  })
}

t("addStyle", "simple",
  doc(p("hello <a>there<b>!")),
  doc(p("hello ", strong("there"), "!")),
  {style: style.strong})
t("addStyle", "double_bold",
  doc(p("hello ", strong("<a>there"), "!<b>")),
  doc(p("hello ", strong("there!"))),
  {style: style.strong})
t("addStyle", "overlap",
  doc(p("one <a>two ", em("three<b> four"))),
  doc(p("one ", strong("two ", em("three")), em(" four"))),
  {style: style.strong})
t("addStyle", "overwrite_link",
  doc(p("this is a ", a("<a>link<b>"))),
  doc(p("this is a ", a2("link"))),
  {style: style.link("http://bar")})
t("addStyle", "code",
  doc(p("before"), blockquote(p("the variable is called <a>i<b>")), p("after")),
  doc(p("before"), blockquote(p("the variable is called ", code("i"))), p("after")),
  {style: style.code})
t("addStyle", "across_blocks",
  doc(p("hi <a>this"), blockquote(p("is")), p("a docu<b>ment"), p("!")),
  doc(p("hi ", em("this")), blockquote(p(em("is"))), p(em("a docu"), "ment"), p("!")),
  {style: style.em})

t("removeStyle", "gap",
  doc(p(em("hello <a>world<b>!"))),
  doc(p(em("hello "), "world", em("!"))),
  {style: style.em})
t("removeStyle", "nothing_there",
  doc(p(em("hello"), " <a>world<b>!")),
  doc(p(em("hello"), " <a>world<b>!")),
  {style: style.em})
t("removeStyle", "from_nested",
  doc(p(em("one ", strong("<a>two<b>"), " three"))),
  doc(p(em("one two three"))),
  {style: style.strong})
t("removeStyle", "unlink",
  doc(p("hello ", a("link"))),
  doc(p("hello link")),
  {style: style.link("http://foo")})
t("removeStyle", "other_link",
  doc(p("hello ", a("link"))),
  doc(p("hello ", a("link"))),
  {style: style.link("http://bar")})
t("removeStyle", "across_blocks",
  doc(blockquote(p(em("much <a>em")), p(em("here too"))), p("between", em("...")), p(em("end<b>"))),
  doc(blockquote(p(em("much "), "em"), p("here too")), p("between..."), p("end")),
  {style: style.em})
t("removeStyle", "all",
  doc(p("<a>hello, ", em("this is ", strong("much"), " ", a("markup<b>")))),
  doc(p("<a>hello, this is much markup")),
  {style: null})

t("setType", "simple",
  doc(p("am<a> i")),
  doc(h2("am i")),
  {type: "heading", attrs: {level: 2}})
t("setType", "multiple",
  doc(h1("<a>hello"), p("there"), p("<b>you"), p("end")),
  doc(pre("hello"), pre("there"), pre("you"), p("end")),
  {type: "code_block"})
t("setType", "inside",
  doc(blockquote(p("one<a>"), p("two<b>"))),
  doc(blockquote(h1("one<a>"), h1("two<b>"))),
  {type: "heading", attrs: {level: 1}})
t("setType", "clear_markup",
  doc(p("hello<a> ", em("world"))),
  doc(pre("hello world")),
  {type: "code_block"})
t("setType", "only_clear_for_code_block",
  doc(p("hello<a> ", em("world"))),
  doc(h1("hello<a> ", em("world"))),
  {type: "heading", attrs: {level: 1}})

function has(name, doc, st, result) {
  defTest("has_" + name, function() {
    if (style.contains(inline.inlineStylesAt(doc, doc.tag.a), st) != result)
      throw new Failure("hasStyle(" + doc + ", " + doc.tag.a + ", " + st.type + ") returned " + !result)
  })
}

has("simple",
    doc(p(em("fo<a>o"))),
    style.em,
    true)
has("simple_not",
    doc(p(em("fo<a>o"))),
    style.strong,
    false)
has("after",
    doc(p(em("hi"), "<a> there")),
    style.em,
    true)
has("before",
    doc(p("one <a>", em("two"))),
    style.em,
    false)
has("start",
    doc(p(em("<a>one"))),
    style.em,
    true)
has("different_link",
    doc(p(a("li<a>nk"))),
    style.link("http://baz"),
    false)

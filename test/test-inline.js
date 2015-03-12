import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import tests from "./tests"
import {testTransform} from "./cmp"

import {inline, style, Node} from "../src/model"

function t(op, name, doc, expect, params) {
  tests[op + "_" + name] = function() {
    if (!params) params = {}
    params.name = op
    if (!params.pos) params.pos = doc.tag.a
    if (!params.end) params.end = doc.tag.b
    testTransform(doc, expect, params)
  }
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

t("insertText", "simple",
  doc(p("hello<a>")),
  doc(p("hello world<a>")),
  {text: " world"})
t("insertText", "simple_inside",
  doc(p("he<a>llo")),
  doc(p("hej<a>llo")),
  {text: "j"})
t("insertText", "left_associative",
  doc(p(em("hello<a>"), " world<after>")),
  doc(p(em("hello big"), " world<after>")),
  {text: " big"})
t("insertText", "paths",
  doc(p("<1>before"), p("<2>here<a>"), p("after<3>")),
  doc(p("<1>before"), p("<2>here!<a>"), p("after<3>")),
  {text: "!"})
t("insertText", "at start",
  doc(p("<a>one")),
  doc(p("two <a>one")),
  {text: "two "})
t("insertText", "after br",
  doc(p("hello", br, "<a>you")),
  doc(p("hello", br, "...you")),
  {text: "..."})
t("insertText", "after_br_nojoin",
  doc(p("hello", br, em("<a>you"))),
  doc(p("hello", br, "...", em("you"))),
  {text: "..."})
t("insertText", "before_br",
  doc(p("<a>", br, "ok")),
  doc(p("ay", br, "ok")),
  {text: "ay"})

function has(name, doc, style, result) {
  tests["has_" + name] = function() {
    if (inline.hasStyle(doc, doc.tag.a, style) != result)
      throw new Failure("hasStyle(" + doc + ", " + doc.tag.a + ", " + style.type + ") returned " + !result)
  }
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

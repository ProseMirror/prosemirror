import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import tests from "./tests"
import {transform} from "./cmp"

import {inline, style, Node} from "../src/model"

function t(op, name, doc, stl, expect) {
  tests[op + "_" + name] = function() {
    transform(doc, expect,
              () => inline[op](doc, doc.tag.a, doc.tag.b || doc.tag.a, stl))
  }
}

t("addStyle", "simple",
  doc(p("hello <a>there<b>!")),
  style.strong,
  doc(p("hello ", strong("there"), "!")))
t("addStyle", "double_bold",
  doc(p("hello ", strong("<a>there"), "!<b>")),
  style.strong,
  doc(p("hello ", strong("there!"))))
t("addStyle", "overlap",
  doc(p("one <a>two ", em("three<b> four"))),
  style.strong,
  doc(p("one ", strong("two ", em("three")), em(" four"))))
t("addStyle", "overwrite_link",
  doc(p("this is a ", a("<a>link<b>"))),
  style.link("http://bar"),
  doc(p("this is a ", a2("link"))))
t("addStyle", "code",
  doc(p("before"), blockquote(p("the variable is called <a>i<b>")), p("after")),
  style.code,
  doc(p("before"), blockquote(p("the variable is called ", code("i"))), p("after")))
t("addStyle", "across_blocks",
  doc(p("hi <a>this"), blockquote(p("is")), p("a docu<b>ment"), p("!")),
  style.em,
  doc(p("hi ", em("this")), blockquote(p(em("is"))), p(em("a docu"), "ment"), p("!")))

t("removeStyle", "gap",
  doc(p(em("hello <a>world<b>!"))),
  style.em,
  doc(p(em("hello "), "world", em("!"))))
t("removeStyle", "nothing_there",
  doc(p(em("hello"), " <a>world<b>!")),
  style.em,
  doc(p(em("hello"), " <a>world<b>!")))
t("removeStyle", "from_nested",
  doc(p(em("one ", strong("<a>two<b>"), " three"))),
  style.strong,
  doc(p(em("one two three"))))
t("removeStyle", "unlink",
  doc(p("hello ", a("link"))),
  style.link("http://foo"),
  doc(p("hello link")))
t("removeStyle", "other_link",
  doc(p("hello ", a("link"))),
  style.link("http://bar"),
  doc(p("hello ", a("link"))))
t("removeStyle", "across_blocks",
  doc(blockquote(p(em("much <a>em")), p(em("here too"))), p("between", em("...")), p(em("end<b>"))),
  style.em,
  doc(blockquote(p(em("much "), "em"), p("here too")), p("between..."), p("end")))

t("setType", "simple",
  doc(p("am<a> i")),
  new Node("heading", null, {level: 2}),
  doc(h2("am i")))
t("setType", "multiple",
  doc(h1("<a>hello"), p("there"), p("<b>you"), p("end")),
  new Node("code_block"),
  doc(pre("hello"), pre("there"), pre("you"), p("end")))
t("setType", "inside",
  doc(blockquote(p("one<a>"), p("two<b>"))),
  new Node("heading", null, {level: 1}),
  doc(blockquote(h1("one<a>"), h1("two<b>"))))

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

function text(name, doc, text, expected) {
  tests["insertText_" + name] = function() {
    transform(doc, expected,
              () => inline.insertText(doc, doc.tag.a, text))
  }
}

text("simple",
     doc(p("hello<a>")),
     " world",
     doc(p("hello world<a>")))
text("simple_inside",
     doc(p("he<a>llo")),
     "j",
     doc(p("hej<a>llo")))
text("left_associative",
     doc(p(em("hello<a>"), " world<after>")),
     " big",
     doc(p(em("hello big"), " world<after>")))
text("paths",
     doc(p("<1>before"), p("<2>here<a>"), p("after<3>")),
     "!",
     doc(p("<1>before"), p("<2>here!<a>"), p("after<3>")))
text("at start",
     doc(p("<a>one")),
     "two ",
     doc(p("two <a>one")))
text("after br",
     doc(p("hello", br, "<a>you")),
     "...",
     doc(p("hello", br, "...you")))
text("after_br_nojoin",
     doc(p("hello", br, em("<a>you"))),
     "...",
     doc(p("hello", br, "...", em("you"))))
text("before_br",
     doc(p("<a>", br, "ok")),
     "ay",
     doc(p("ay", br, "ok")))

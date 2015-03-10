import {doc, blockquote, h1, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import * as inline from "../src/inline"
import tests from "./tests"
import cmpNode from "./cmpnode"

import * as style from "../src/style"

function t(op, name, doc, stl, expect) {
  tests[op + "_" + name] = function() {
    let result = inline[op](doc, doc.tag.a, doc.tag.b || doc.tag.a, stl)
    cmpNode(result, expect)
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

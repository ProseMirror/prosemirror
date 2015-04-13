import {style, Node} from "../src/model"
import {addStyle, removeStyle, insert, insertText, del as del_, applyTransform} from "../src/trans"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "./build"

import Failure from "./failure"
import tests from "./tests"
import {cmpNode, cmpStr} from "./cmp"

export function testTransform(doc, expect, steps) {
  let orig = doc.toString(), out = doc, results = []
  for (let i = 0; i < steps.length; i++) {
    let result = applyTransform(out, steps[i])
    out = result.doc
    results.push(result)
  }
  cmpNode(out, expect)
  cmpStr(doc, orig, "immutable")
  for (let pos in expect.tag) {
    let val = doc.tag[pos], offset = []
    for (let i = 0; i < results.length; i++)
      ({pos: val, offset: offset[i]} = results[i].map._map(val))
    cmpStr(val, expect.tag[pos], pos)
    for (let i = results.length - 1; i >= 0; i--)
      val = results[i].map._map(val, true, offset[i]).pos
    cmpStr(val, doc.tag[pos], pos + " back")
  }
}

function add(name, doc, expect, style) {
  tests["addStyle__" + name] = () => {
    testTransform(doc, expect, addStyle(doc, doc.tag.a, doc.tag.b, style))
  }
}

add("simple",
    doc(p("hello <a>there<b>!")),
    doc(p("hello ", strong("there"), "!")),
    style.strong)
add("double_bold",
    doc(p("hello ", strong("<a>there"), "!<b>")),
    doc(p("hello ", strong("there!"))),
    style.strong)
add("overlap",
    doc(p("one <a>two ", em("three<b> four"))),
    doc(p("one ", strong("two ", em("three")), em(" four"))),
    style.strong)
add("overwrite_link",
    doc(p("this is a ", a("<a>link<b>"))),
    doc(p("this is a ", a2("link"))),
    style.link("http://bar"))
add("code",
    doc(p("before"), blockquote(p("the variable is called <a>i<b>")), p("after")),
    doc(p("before"), blockquote(p("the variable is called ", code("i"))), p("after")),
    style.code)
add("across_blocks",
    doc(p("hi <a>this"), blockquote(p("is")), p("a docu<b>ment"), p("!")),
    doc(p("hi ", em("this")), blockquote(p(em("is"))), p(em("a docu"), "ment"), p("!")),
    style.em)

function rem(name, doc, expect, style) {
  tests["removeStyle__" + name] = () => {
    testTransform(doc, expect, removeStyle(doc, doc.tag.a, doc.tag.b, style))
  }
}

rem("gap",
    doc(p(em("hello <a>world<b>!"))),
    doc(p(em("hello "), "world", em("!"))),
    style.em)
rem("nothing_there",
    doc(p(em("hello"), " <a>world<b>!")),
    doc(p(em("hello"), " <a>world<b>!")),
    style.em)
rem("from_nested",
    doc(p(em("one ", strong("<a>two<b>"), " three"))),
    doc(p(em("one two three"))),
    style.strong)
rem("unlink",
    doc(p("hello ", a("link"))),
    doc(p("hello link")),
    style.link("http://foo"))
rem("other_link",
    doc(p("hello ", a("link"))),
    doc(p("hello ", a("link"))),
    style.link("http://bar"))
rem("across_blocks",
    doc(blockquote(p(em("much <a>em")), p(em("here too"))), p("between", em("...")), p(em("end<b>"))),
    doc(blockquote(p(em("much "), "em"), p("here too")), p("between..."), p("end")),
    style.em)
rem("all",
    doc(p("<a>hello, ", em("this is ", strong("much"), " ", a("markup<b>")))),
    doc(p("<a>hello, this is much markup")),
    null)

function ins(name, doc, expect, nodes) {
  tests["insert__" + name] = () => {
    testTransform(doc, expect, insert(doc.tag.a, nodes))
  }
}

ins("break",
    doc(p("hello<a>there")),
    doc(p("hello", br, "<a>there")),
    new Node.Inline("hard_break"))
ins("simple",
    doc(p("one"), "<a>", p("two<2>")),
    doc(p("one"), p(), "<a>", p("two<2>")),
    new Node("paragraph"))
ins("two",
    doc(p("one"), "<a>", p("two<2>")),
    doc(p("one"), p("hi"), hr, "<a>", p("two<2>")),
    [new Node("paragraph", [new Node.text("hi")]),
     new Node("horizontal_rule")])
ins("end_of_blockquote",
    doc(blockquote(p("he<before>y"), "<a>"), p("after<after>")),
    doc(blockquote(p("he<before>y"), p()), p("after<after>")),
    new Node("paragraph"))
ins("start_of_blockquote",
    doc(blockquote("<a>", p("he<1>y")), p("after<2>")),
    doc(blockquote(p(), "<a>", p("he<1>y")), p("after<2>")),
    new Node("paragraph"))

function del(name, doc, expect) {
  tests["delete__" + name] = () => {
    testTransform(doc, expect, del_(doc, doc.tag.a, doc.tag.b))
  }
}

del("simple",
    doc(p("<1>one"), "<a>", p("tw<2>o"), "<b>", p("<3>three")),
    doc(p("<1>one"), "<a><2>", p("<3>three")))
del("only_child",
    doc(blockquote("<a>", p("hi"), "<b>"), p("x")),
    doc(blockquote(), p("x")))
del("outside_path",
    doc(blockquote(p("a"), "<a>", p("b"), "<b>"), p("c<1>")),
    doc(blockquote(p("a")), p("c<1>")))

function txt(name, doc, expect, text) {
  tests["insertText__" + name] = () => {
    testTransform(doc, expect, insertText(doc.tag.a, text))
  }
}

txt("inherit_style",
    doc(p(em("he<a>lo"))),
    doc(p(em("hello"))),
    "l")
txt("simple",
    doc(p("hello<a>")),
    doc(p("hello world<a>")),
    " world")
txt("simple_inside",
    doc(p("he<a>llo")),
    doc(p("hej<a>llo")),
     "j")
txt("left_associative",
    doc(p(em("hello<a>"), " world<after>")),
    doc(p(em("hello big"), " world<after>")),
    " big")
txt("paths",
    doc(p("<1>before"), p("<2>here<a>"), p("after<3>")),
    doc(p("<1>before"), p("<2>here!<a>"), p("after<3>")),
    "!")
txt("at_start",
    doc(p("<a>one")),
    doc(p("two <a>one")),
    "two ")
txt("after br",
    doc(p("hello", br, "<a>you")),
    doc(p("hello", br, "...you")),
    "...")
txt("after_br_nojoin",
    doc(p("hello", br, em("<a>you"))),
    doc(p("hello", br, "...<a>", em("you"))),
    "...")
txt("before_br",
    doc(p("<a>", br, "ok")),
    doc(p("ay", br, "ok")),
    "ay")

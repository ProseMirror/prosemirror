import {style} from "../src/model"
import {addStyle, removeStyle} from "../src/trans/style"
import {applyTransform} from "../src/trans/transform"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import tests from "./tests"
import {cmpNode, cmpStr} from "./cmp"

export function testTransform(doc, expect, steps) {
  let orig = doc.toString(), result = doc
  for (let i = 0; i < steps.length; i++)
    result = applyTransform(result, steps[i]).doc
  cmpNode(result, expect)
  cmpStr(doc, orig, "immutable")
/*  for (let pos in expect.tag) {
    let offset, mapped = result.map(doc.tag[pos], p => offset = p)
    cmpStr(mapped, expect.tag[pos], pos)
    cmpStr(result.mapBack(mapped, offset), doc.tag[pos], pos + " back")
  }*/
}

function add(name, doc, expect, style) {
  tests["addStyle__" + name] = () => {
    testTransform(doc, expect, addStyle(doc, doc.tag.a, doc.tag.b, style))
  }
}

function rem(name, doc, expect, style) {
  tests["removeStyle__" + name] = () => {
    testTransform(doc, expect, removeStyle(doc, doc.tag.a, doc.tag.b, style))
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

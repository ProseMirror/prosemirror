import {doc, blockquote, h1, p, li, ol, ul, em, a, br} from "./build"

import Failure from "./failure"
import * as block from "../src/block"
import tests from "./tests"
import cmpNode from "./cmpnode"

import Node from "../src/node"
import Pos from "../src/pos"

function cmp(a, b, comment) {
  let as = a.toString(), bs = b.toString()
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}

function t(op, name, doc, expect, wrap) {
  tests[op + "_" + name] = function() {
    if (wrap) wrap = new Node(Node.types[wrap], null, Node.types[wrap].defaultAttrs)
    let result = block[op](doc, doc.tag.a, doc.tag.b || doc.tag.a, wrap)
    cmpNode(result.doc, expect)
    for (let pos in expect.tag)
      cmp(result.map(doc.tag[pos]), expect.tag[pos], pos)
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
t("lift", "noop",
  doc(p("<a>hi")),
  doc(p("<a>hi")))
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
  doc(ul(li(p("one"))), p("two"), ul(li(p("three")))))
t("lift", "multiple_from_list",
  doc(ul(li(p("one<a>")), li(p("two<b>")), li(p("three<after>")))),
  doc(p("one<a>"), p("two<b>"), ul(li(p("three<after>")))))
t("lift", "multiple_from_list_with_two_items",
  doc(ul(li(p("one<a>"), p("<half>half")), li(p("two<b>")), li(p("three<after>")))),
  doc(p("one<a>"), p("<half>half"), p("two<b>"), ul(li(p("three<after>")))))

t("join", "simple",
  doc(blockquote(p("<before>a")), blockquote(p("<a>b")), p("after<after>")),
  doc(blockquote(p("<before>a"), p("<a>b")), p("after<after>")))
t("join", "deeper",
  doc(blockquote(blockquote(p("a"), p("b<before>")), blockquote(p("<a>c"), p("d<after>")))),
  doc(blockquote(blockquote(p("a"), p("b<before>"), p("<a>c"), p("d<after>")))))
t("join", "lists",
  doc(ol(li(p("one")), li(p("two"))), ol(li(p("three<a>")))),
  doc(ol(li(p("one")), li(p("two")), li(p("three<a>")))))
t("join", "list_item",
  doc(ol(li(p("one")), li(p("two")), li(p("three<a>")))),
  doc(ol(li(p("one")), li(p("two"), p("three<a>")))))

t("wrap", "simple",
  doc(p("one"), p("<a>two"), p("three")),
  doc(p("one"), blockquote(p("<a>two")), p("three")),
  "blockquote")
t("wrap", "two",
  doc(p("one<1>"), p("<a>two"), p("<b>three"), p("four<4>")),
  doc(p("one<1>"), blockquote(p("<a>two"), p("three")), p("four<4>")),
  "blockquote")
t("wrap", "list",
  doc(p("<a>one"), p("<b>two")),
  doc(ol(li(p("<a>one")), li(p("<b>two")))),
  "ordered_list")
t("wrap", "nested_list",
  doc(ol(li(p("<1>one")), li(p("<a>two"), p("<b>three")), li(p("<4>four")))),
  doc(ol(li(p("<1>one")), li(ol(li(p("<a>two")), li(p("<b>three")))), li(p("<4>four")))),
  "ordered_list")
t("wrap", "not_possible",
  doc(p("hi<a>")),
  doc(p("hi<a>")),
  "horizontal_rule")
t("wrap", "include_parent",
  doc(blockquote(p("<1>one"), p("two<a>")), p("three<b>")),
  doc(blockquote(blockquote(p("<1>one"), p("two<a>")), p("three<b>"))),
  "blockquote")

function insert(name, doc, pos, value, expected) {
  tests["insertBlock_" + name] = function() {
    let result = block.insertBlock(doc, new Pos(pos.slice(0, pos.length - 1), pos[pos.length - 1], false), value.content[0])
    cmpNode(result.doc, expected)
    for (var name in expected.tag)
      cmp(result.map(doc.tag[name]), expected.tag[name])
  }
}

insert("simple",
       doc(p("one<1>"), p("two<2>")),
       [1],
       doc(p("one and a half")),
       doc(p("one<1>"), p("one and a half"), p("two<2>")))
insert("end_of_blockquote",
       doc(blockquote(p("he<before>y")), p("after<after>")),
       [0, 1],
       doc(p("aye")),
       doc(blockquote(p("he<before>y"), p("aye")), p("after<after>")))
insert("start_of_blockquote",
       doc(blockquote(p("he<1>y")), p("after<2>")),
       [0, 0],
       doc(p("aye")),
       doc(blockquote(p("aye"), p("he<1>y")), p("after<2>")))

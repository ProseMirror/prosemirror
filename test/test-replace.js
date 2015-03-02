import {doc, h1, p, li, ol, ul, em, a, br} from "./build"

import Failure from "./failure"
import replace from "../src/replace"

const tests = {}

export default tests

function cmp(a, b, comment) {
  let as = a.toString(), bs = b.toString()
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}

function t(name, base, insert, expect) {
  tests[name] = function() {
    let result = replace(base, base.tag.a, base.tag.b || base.tag.a,
                         insert, insert && insert.tag.a, insert && insert.tag.b)
    cmp(result.doc, expect)
    for (let pos in expect.tag)
      cmp(result.map(base.tag[pos]), expect.tag[pos], pos)
  }
}

t("replace",
  doc(p("he<before>llo<a> w<after>orld")),
  doc(p("<a> big<b>")),
  doc(p("he<before>llo big w<after>orld")))

t("replace_insert_paragraph",
  doc(p("one<a>two")),
  doc(p("a<a>"), p("hello"), p("<b>b")),
  doc(p("one"), p("hello"), p("<a>two")))

t("replace_overwrite_paragraph",
  doc(p("one<a>"), p("t<inside>wo"), p("<b>three<end>")),
  doc(p("a<a>"), p("TWO"), p("<b>b")),
  doc(p("one"), p("TWO"), p("<b>three<end>")))

t("replace_stitch",
  doc(p("foo ", em("bar<a>baz"), "<b> quux")),
  doc(p("foo ", em("xy<a>zzy"), " foo<b>")),
  doc(p("foo ", em("barzzy"), " foo quux")))

t("replace_break",
  doc(p("foo<a>b<inside>b<b>bar")),
  doc(p("<a>", br, "<b>")),
  doc(p("foo", br, "<inside>bar")))

t("replace_cut_different_block",
  doc(h1("hell<a>o"), p("by<b>e")),
  null,
  doc(h1("helle")))

t("replace_restore_list",
  doc(h1("hell<a>o"), p("by<b>e")),
  doc(ol(li(p("on<a>e")), li(p("tw<b>o")))),
  doc(h1("helle"), ol(li(p("twe")))))

t("replace_in_empty_block",
  doc(p("a"), p("<a>"), p("b")),
  doc(p("x<a>y<b>z")),
  doc(p("a"), p("y<a>"), p("b")))

t("replace_ignore_across_block",
  doc(p("on<a>e"), h1("<b>head")),
  doc(p("<a>a"), p("b<b>")),
  doc(p("ona"), p("b"), h1("head")))

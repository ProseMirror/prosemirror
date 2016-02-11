import {doc, p, li, ul, em, a} from "./build"

import {Failure} from "./failure"
import {defTest} from "./tests"
import {cmpNode} from "./cmp"

function t(name, doc, expect) {
  defTest("slice_" + name, () => {
    if (doc.tag.a && doc.tag.b)
      cmpNode(doc.sliceBetween(doc.tag.a, doc.tag.b), expect)
    else if (doc.tag.a)
      cmpNode(doc.sliceBetween(null, doc.tag.a), expect)
    else
      cmpNode(doc.sliceBetween(doc.tag.b, null), expect)
  })
}

t("before",
  doc(p("hello<a> world")),
  doc(p("hello")))
t("before_everything",
  doc(p("hello<a>")),
  doc(p("hello")))
t("before_rest",
  doc(p("hello<a> world"), p("rest")),
  doc(p("hello")))
t("before_styled",
  doc(p("hello ", em("WOR<a>LD"))),
  doc(p("hello ", em("WOR"))))
t("before_2nd",
  doc(p("a"), p("b<a>")),
  doc(p("a"), p("b")))

t("after",
  doc(p("hello<b> world")),
  doc(p(" world")))
t("after_everythin",
  doc(p("<b>hello")),
  doc(p("hello")))
t("after_rest",
  doc(p("foo"), p("bar<b>baz")),
  doc(p("baz")))
t("after_styled",
  doc(p("a sentence with an ", em("emphasized ", a("li<b>nk")), " in it")),
  doc(p(em(a("nk")), " in it")))
t("after_among_styled",
  doc(p("a ", em("sentence"), " wi<b>th ", em("text"), " in it")),
  doc(p("th ", em("text"), " in it")))

t("between",
  doc(p("hell<a>o wo<b>rld")),
  doc(p("o wo")))
t("between_paragraphs",
  doc(p("on<a>e"), p("t<b>wo")),
  doc(p("e"), p("t")))
t("between_across_inline",
  doc(p("here's noth<a>ing and ", em("here's e<b>m"))),
  doc(p("ing and ", em("here's e"))))
t("between_different_depth",
  doc(ul(li(p("hello")), li(p("wo<a>rld")), li(p("x"))), p(em("bo<b>o"))),
  doc(ul(li(p("rld")), li(p("x"))), p(em("bo"))))

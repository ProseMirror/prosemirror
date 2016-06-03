const {doc, p, li, ul, em, a, blockquote} = require("./build")

const {defTest} = require("./tests")
const {cmpNode, cmp} = require("./cmp")

function t(name, doc, expect, openLeft, openRight) {
  defTest("slice_" + name, () => {
    let slice
    if (doc.tag.a != null && doc.tag.b != null)
      slice = doc.slice(doc.tag.a, doc.tag.b)
    else if (doc.tag.a != null)
      slice = doc.slice(0, doc.tag.a)
    else
      slice = doc.slice(doc.tag.b)
    cmpNode(slice.content, expect.content)
    cmp(slice.openLeft, openLeft, "openLeft")
    cmp(slice.openRight, openRight, "openRight")
  })
}

t("before",
  doc(p("hello<a> world")),
  doc(p("hello")), 0, 1)
t("before_everything",
  doc(p("hello<a>")),
  doc(p("hello")), 0, 1)
t("before_rest",
  doc(p("hello<a> world"), p("rest")),
  doc(p("hello")), 0, 1)
t("before_styled",
  doc(p("hello ", em("WOR<a>LD"))),
  doc(p("hello ", em("WOR"))), 0, 1)
t("before_2nd",
  doc(p("a"), p("b<a>")),
  doc(p("a"), p("b")), 0, 1)
t("before_top",
  doc(p("a"), "<a>", p("b")),
  doc(p("a")), 0, 0)
t("before_deep",
  doc(blockquote(ul(li(p("a")), li(p("b<a>"))))),
  doc(blockquote(ul(li(p("a")), li(p("b"))))), 0, 4)

t("after",
  doc(p("hello<b> world")),
  doc(p(" world")), 1, 0)
t("after_everything",
  doc(p("<b>hello")),
  doc(p("hello")), 1, 0)
t("after_rest",
  doc(p("foo"), p("bar<b>baz")),
  doc(p("baz")), 1, 0)
t("after_styled",
  doc(p("a sentence with an ", em("emphasized ", a("li<b>nk")), " in it")),
  doc(p(em(a("nk")), " in it")), 1, 0)
t("after_among_styled",
  doc(p("a ", em("sentence"), " wi<b>th ", em("text"), " in it")),
  doc(p("th ", em("text"), " in it")), 1, 0)
t("after_top",
  doc(p("a"), "<b>", p("b")),
  doc(p("b")), 0, 0)
t("after_deep",
  doc(blockquote(ul(li(p("a")), li(p("<b>b"))))),
  doc(blockquote(ul(li(p("b"))))), 4, 0)

t("between_text",
  doc(p("hell<a>o wo<b>rld")),
  p("o wo"), 0, 0)
t("between_paragraphs",
  doc(p("on<a>e"), p("t<b>wo")),
  doc(p("e"), p("t")), 1, 1)
t("between_across_inline",
  doc(p("here's noth<a>ing and ", em("here's e<b>m"))),
  p("ing and ", em("here's e")), 0, 0)
t("between_different_depth",
  doc(ul(li(p("hello")), li(p("wo<a>rld")), li(p("x"))), p(em("bo<b>o"))),
  doc(ul(li(p("rld")), li(p("x"))), p(em("bo"))), 3, 1)
t("between_deep",
  doc(blockquote(p("foo<a>bar"), ul(li(p("a")), li(p("b"), "<b>", p("c"))), p("d"))),
  blockquote(p("bar"), ul(li(p("a")), li(p("b")))), 1, 2)

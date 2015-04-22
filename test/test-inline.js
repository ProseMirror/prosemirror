import {inline, style, Node, Pos} from "../src/model"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br} from "./build"

import Failure from "./failure"
import {defTest} from "./tests"

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

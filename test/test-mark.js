import {Mark, defaultSchema as schema} from "../src/model"
import {Failure} from "./failure"
import {defTest} from "./tests"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, a, a2, br} from "./build"

function assert(name, value) {
  if (!value) throw new Failure("Assertion failed: " + name)
}

let em_ = schema.mark("em")
let strong = schema.mark("strong")
let link = (href, title) => schema.mark("link", {href, title})
let code = schema.mark("code")

defTest("mark_same", () => {
  assert("empty", Mark.sameSet([], []))
  assert("two", Mark.sameSet([em_, strong], [em_, strong]))
  assert("diff set", !Mark.sameSet([em_, strong], [em_, code]))
  assert("diff size", !Mark.sameSet([em_, strong], [em_, strong, code]))
  assert("links", link("http://foo").eq(link("http://foo")))
  assert("diff links", !link("http://foo").eq(link("http://bar")))
  assert("diff title", !link("http://foo", "A").eq(link("http://foo", "B")))
  assert("link in set", Mark.sameSet([link("http://foo"), code],
                                   [link("http://foo"), code]))
  assert("diff link in set", !Mark.sameSet([link("http://foo"), code],
                                         [link("http://bar"), code]))
})

defTest("mark_add", () => {
  assert("from empty", em_.addToSet([]), [em_])
  assert("duplicate", em_.addToSet([em_]), [em_])
  assert("at start", em_.addToSet([strong]), [em_, strong])
  assert("at end", strong.addToSet([em_]), [em_, strong])
  assert("replace link", link("http://bar").addToSet([em_, link("http://foo")]),
         [em_, link("http://bar")])
  assert("same link", link("http://foo").addToSet([em_, link("http://foo")]),
         [em_, link("http://foo")])
  assert("code at end", code.addToSet([em_, strong, link("http://foo")]),
         [em_, strong, link("http://foo"), code])
  assert("strong in middle", strong.addToSet([em_, code]), [em_, strong, code])
})

defTest("mark_remove", () => {
  assert("empty", em_.removeFromSet([]), [])
  assert("single", em_.removeFromSet([em_]), []),
  assert("not in set", strong.removeFromSet([em_]), [em_])
  assert("link", link("http://foo").removeFromSet([link("http://foo")]), [])
  assert("different link", link("http://foo", "title").removeFromSet([link("http://foo")]),
         [link("http://foo")])
})

function has(name, doc, st, result) {
  defTest("has_mark_" + name, function() {
    if (st.isInSet(doc.marksAt(doc.tag.a)) != result)
      throw new Failure("hasMark(" + doc + ", " + doc.tag.a + ", " + st.type + ") returned " + !result)
  })
}

has("simple",
    doc(p(em("fo<a>o"))),
    em_,
    true)
has("simple_not",
    doc(p(em("fo<a>o"))),
    strong,
    false)
has("after",
    doc(p(em("hi"), "<a> there")),
    em_,
    true)
has("before",
    doc(p("one <a>", em("two"))),
    em_,
    false)
has("start",
    doc(p(em("<a>one"))),
    em_,
    true)
has("different_link",
    doc(p(a("li<a>nk"))),
    link("http://baz"),
    false)

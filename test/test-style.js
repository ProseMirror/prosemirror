import * as style from "../src/model/style"
import Failure from "./failure"
import {defTest} from "./tests"

function assert(name, value) {
  if (!value) throw new Failure("Assertion failed: " + name)
}

function same(name, value, expected) {
  assert(name, (Array.isArray(expected) ? style.sameSet : style.same)(value, expected))
}

defTest("style_same", () => {
  assert("empty", style.sameSet([], []))
  assert("two", style.sameSet([style.em, style.strong], [style.em, style.strong]))
  assert("diff set", !style.sameSet([style.em, style.strong], [style.em, style.code]))
  assert("diff size", !style.sameSet([style.em, style.strong], [style.em, style.strong, style.code]))
  assert("links", style.same(style.link("http://foo"), style.link("http://foo")))
  assert("diff links", !style.same(style.link("http://foo"), style.link("http://bar")))
  assert("diff title", !style.same(style.link("http://foo", "A"), style.link("http://foo", "B")))
  assert("link in set", style.sameSet([style.link("http://foo"), style.code],
                                      [style.link("http://foo"), style.code]))
  assert("diff link in set", !style.sameSet([style.link("http://foo"), style.code],
                                            [style.link("http://bar"), style.code]))
})

defTest("style_add", () => {
  assert("from empty", style.add([], style.em), [style.em])
  assert("duplicate", style.add([style.em], style.em), [style.em])
  assert("at start", style.add([style.strong], style.em), [style.em, style.strong])
  assert("at end", style.add([style.em], style.strong), [style.em, style.strong])
  assert("replace link", style.add([style.em, style.link("http://foo")], style.link("http://bar")),
         [style.em, style.link("http://bar")])
  assert("same link", style.add([style.em, style.link("http://foo")], style.link("http://foo")),
         [style.em, style.link("http://foo")])
  assert("code at end", style.add([style.em, style.strong, style.link("http://foo")], style.code),
         [style.em, style.strong, style.link("http://foo"), style.code])
})

defTest("style_remove", () => {
  assert("empty", style.remove([], style.em), [])
  assert("single", style.remove([style.em], style.em), []),
  assert("not in set", style.remove([style.em], style.strong), style.em)
  assert("link", style.remove([style.link("http://foo")], style.link("http://foo")), [])
  assert("different link", style.remove([style.link("http://foo")], style.link("http://foo", "title")),
         [style.link("http://foo")])
})

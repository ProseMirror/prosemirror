import {findDiffStart, findDiffEnd} from "../src/model"

import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "./build"

import {defTest} from "./tests"
import {cmpStr, P} from "./cmp"
import {Failure} from "./failure"

function t(name, type, a, b, pos) {
  defTest("diff_" + type + "_" + name, () => {
    let result
    if (type == "start") {
      result = findDiffStart(a.content, b.content)
    } else {
      let found = findDiffEnd(a.content, b.content)
      result = found && found.a
    }
    if (!pos) {
      if (result) throw new Failure("Unexpectedly found a difference")
    } else {
      if (!result) throw new Failure("Unexpectedly found no difference")
      cmpStr(result, pos)
    }
  })
}

function sta(name, a, b, pos) { t(name, "start", a, b, pos) }
function end(name, a, b, pos) { t(name, "end", a, b, pos) }

sta("none",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    null)

sta("at_end_longer",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye")), p("oops")),
    P(3))

sta("at_end_shorter",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye")), p("oops")),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    P(3))

sta("diff_styles",
    doc(p("a", em("b"))),
    doc(p("a", strong("b"))),
    P(0, 1))

sta("longer_text",
    doc(p("foobar", em("b"))),
    doc(p("foo", em("b"))),
    P(0, 3))

sta("different_text",
    doc(p("foobar")),
    doc(p("foocar")),
    P(0, 3))

sta("different_node",
    doc(p("a"), p("b")),
    doc(p("a"), h1("b")),
    P(1))

sta("at_start",
    doc(p("b")),
    doc(h1("b")),
    P(0))

end("none",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    null)

end("at_start_longer",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("oops"), p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    P(0))

end("at_start_shorter",
    doc(p("oops"), p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    P(1))

end("diff_styles",
    doc(p("a", em("b"), "c")),
    doc(p("a", strong("b"), "c")),
    P(0, 2))

end("longer_text",
    doc(p("barfoo", em("b"))),
    doc(p("foo", em("b"))),
    P(0, 3))

end("different_text",
    doc(p("foobar")),
    doc(p("foocar")),
    P(0, 4))

end("different_node",
    doc(p("a"), p("b")),
    doc(h1("a"), p("b")),
    P(1))

end("at_end",
    doc(p("b")),
    doc(h1("b")),
    P(1))

end("similar_start",
    doc(p("hello")),
    doc(p("hey"), p("hello")),
    P(0))

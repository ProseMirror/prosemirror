const {doc, blockquote, h1, p, em, strong} = require("./build")

const {defTest} = require("./tests")
const {cmpStr} = require("./cmp")
const {Failure} = require("./failure")

function t(name, type, a, b, pos) {
  defTest("diff_" + type + "_" + name, () => {
    let result
    if (type == "start") {
      result = a.content.findDiffStart(b.content)
    } else {
      let found = a.content.findDiffEnd(b.content)
      result = found && found.a
    }
    if (pos == null) {
      if (result != null) throw new Failure("Unexpectedly found a difference")
    } else {
      if (result == null) throw new Failure("Unexpectedly found no difference")
      cmpStr(result, pos)
    }
  })
}

function sta(name, a, b) { t(name, "start", a, b, a.tag.a) }
function end(name, a, b) { t(name, "end", a, b, a.tag.a) }

sta("none",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))))

sta("at_end_longer",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye")), "<a>"),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye")), p("oops")))

sta("at_end_shorter",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye")), "<a>", p("oops")),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))))

sta("diff_styles",
    doc(p("a<a>", em("b"))),
    doc(p("a", strong("b"))))

sta("longer_text",
    doc(p("foo<a>bar", em("b"))),
    doc(p("foo", em("b"))))

sta("different_text",
    doc(p("foo<a>bar")),
    doc(p("foocar")))

sta("different_node",
    doc(p("a"), "<a>", p("b")),
    doc(p("a"), h1("b")))

sta("at_start",
    doc("<a>", p("b")),
    doc(h1("b")))

end("none",
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))))

end("at_start_longer",
    doc("<a>", p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("oops"), p("a", em("b")), p("hello"), blockquote(h1("bye"))))

end("at_start_shorter",
    doc(p("oops"), "<a>", p("a", em("b")), p("hello"), blockquote(h1("bye"))),
    doc(p("a", em("b")), p("hello"), blockquote(h1("bye"))))

end("diff_styles",
    doc(p("a", em("b"), "<a>c")),
    doc(p("a", strong("b"), "c")))

end("longer_text",
    doc(p("bar<a>foo", em("b"))),
    doc(p("foo", em("b"))))

end("different_text",
    doc(p("foob<a>ar")),
    doc(p("foocar")))

end("different_node",
    doc(p("a"), "<a>", p("b")),
    doc(h1("a"), p("b")))

end("at_end",
    doc(p("b"), "<a>"),
    doc(h1("b")))

end("similar_start",
    doc("<a>", p("hello")),
    doc(p("hey"), p("hello")))

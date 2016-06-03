const {Slice, ReplaceError} = require("../model")

const {doc, blockquote, h1, p, ul, li} = require("./build")
const {defTest} = require("./tests")
const {cmpNode} = require("./cmp")
const {Failure} = require("./failure")

function test(name, doc, insert, expected) {
  defTest("node_replace_" + name, () => {
    let slice = insert ? insert.slice(insert.tag.a, insert.tag.b) : Slice.empty
    cmpNode(doc.replace(doc.tag.a, doc.tag.b, slice), expected)
  })
}

test("delete_join",
     doc(p("on<a>e"), p("t<b>wo")),
     null,
     doc(p("onwo")))

test("merge_simple",
     doc(p("on<a>e"), p("t<b>wo")),
     doc(p("xx<a>xx"), p("yy<b>yy")),
     doc(p("onxx"), p("yywo")))

test("replace_with_text",
     doc(p("on<a>e"), p("t<b>wo")),
     doc(p("<a>H<b>")),
     doc(p("onHwo")))

test("insert_text",
     doc(p("before"), p("on<a><b>e"), p("after")),
     doc(p("<a>H<b>")),
     doc(p("before"), p("onHe"), p("after")))

test("non_matching",
     doc(p("on<a>e"), p("t<b>wo")),
     doc(h1("<a>H<b>")),
     doc(p("onHwo")))

test("deep",
     doc(blockquote(blockquote(p("on<a>e"), p("t<b>wo")))),
     doc(p("<a>H<b>")),
     doc(blockquote(blockquote(p("onHwo")))))

test("same_block",
     doc(blockquote(p("a<a>bc<b>d"))),
     doc(p("x<a>y<b>z")),
     doc(blockquote(p("ayd"))))

test("deep_lopsided",
     doc(blockquote(blockquote(p("on<a>e"), p("two"), "<b>", p("three")))),
     doc(blockquote(p("aa<a>aa"), p("bb"), p("cc"), "<b>", p("dd"))),
     doc(blockquote(blockquote(p("onaa"), p("bb"), p("cc"), p("three")))))

test("deeper_lopsided",
     doc(blockquote(blockquote(p("on<a>e"), p("two"), p("three")), "<b>", p("x"))),
     doc(blockquote(p("aa<a>aa"), p("bb"), p("cc")), "<b>", p("dd")),
     doc(blockquote(blockquote(p("onaa"), p("bb"), p("cc")), p("x"))))

test("wide_split_delete",
     doc(blockquote(blockquote(p("hell<a>o"))), blockquote(blockquote(p("<b>a")))),
     null,
     doc(blockquote(blockquote(p("hella")))))

test("wide_split_insert",
     doc(blockquote(blockquote(p("hell<a>o"))), blockquote(blockquote(p("<b>a")))),
     doc(p("<a>i<b>")),
     doc(blockquote(blockquote(p("hellia")))))

test("insert_split",
     doc(p("foo<a><b>bar")),
     doc(p("<a>x"), p("y<b>")),
     doc(p("foox"), p("ybar")))

test("insert_deep_split",
     doc(blockquote(p("foo<a>x<b>bar"))),
     doc(blockquote(p("<a>x")), blockquote(p("y<b>"))),
     doc(blockquote(p("foox")), blockquote(p("ybar"))))

test("branched",
     doc(blockquote(p("foo<a>u"), p("v<b>bar"))),
     doc(blockquote(p("<a>x")), blockquote(p("y<b>"))),
     doc(blockquote(p("foox")), blockquote(p("ybar"))))

test("keep_first",
     doc(h1("foo<a>bar"), "<b>"),
     doc(p("foo<a>baz"), "<b>"),
     doc(h1("foobaz")))

test("keep_if_empty",
     doc(h1("<a>bar"), "<b>"),
     doc(p("foo<a>baz"), "<b>"),
     doc(h1("baz")))

function err(name, doc, insert, pattern) {
  defTest("node_replace_error_" + name, () => {
    let slice = insert ? insert.slice(insert.tag.a, insert.tag.b) : Slice.empty
    try {
      doc.replace(doc.tag.a, doc.tag.b, slice)
      throw new Failure("No error raised")
    } catch(e) {
      if (!(e instanceof ReplaceError)) throw e
      if (e.message.toLowerCase().indexOf(pattern) == -1)
        throw new Failure("Wrong error raised: " + e.message)
    }
  })
}

err("negative",
    doc(p("<a><b>")),
    doc(blockquote(p("<a>")), "<b>"),
    "deeper")

err("inconsistent",
    doc(p("<a><b>")),
    doc("<a>", p("<b>")),
    "inconsistent")

err("bad_fit",
    doc("<a><b>"),
    doc(p("<a>foo<b>")),
    "invalid content")

err("bad_join",
    doc(ul(li(p("a")), "<a>"), "<b>"),
    doc(p("foo", "<a>"), "<b>"),
    "cannot join")

err("bad_join_delete",
    doc(blockquote(p("a"), "<a>"), ul("<b>", li(p("b")))),
    null,
    "cannot join")

err("empty_blockquote",
    doc(blockquote("<a>", p("hi")), "<b>"),
    doc(blockquote("hi", "<a>"), "<b>"),
    "invalid content")


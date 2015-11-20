import {defTest} from "../tests"
import {tempEditor} from "./def"
import {cmpNode} from "../cmp"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"

const used = Object.create(null)

function test(cmd, before, after) {
  let known = used[cmd] || 0
  defTest("command_" + cmd + (known ? "_" + (known + 1) : ""), () => {
    let pm = tempEditor({doc: before})
    pm.execCommand(cmd)
    cmpNode(pm.doc, after)
  })
  used[cmd] = known + 1
}

test("insertHardBreak",
     doc(p("fo<a>o")),
     doc(p("fo", br, "o")))
test("insertHardBreak",
     doc(pre("fo<a>o")),
     doc(pre("fo\no")))

test("setStrong",
     doc(p("f<a>o<b>o")),
     doc(p("f", strong("o"), "o")))
test("setStrong",
     doc(p("f<a>oo")),
     doc(p("foo")))
test("setStrong",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("f", strong("oo")), p(strong("ba"), "r")))
test("setStrong",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f<a>o<b>o"))))

test("unsetStrong",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f"), "o", strong("o"))))
test("unsetStrong",
     doc(p("f<a>o<b>o")),
     doc(p("foo")))
test("unsetStrong",
     doc(p("f<a>oo"), p(strong("ba<b>r"))),
     doc(p("foo"), p("ba", strong("r"))))

test("strong",
     doc(p("f<a>o<b>o")),
     doc(p("f", strong("o"), "o")))
test("strong",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f"), "o", strong("o"))))
test("strong",
     doc(p("f<a>oo ", strong("ba<b>r"))),
     doc(p("foo ba", strong("r"))))

test("setEm",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("unsetEm",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))
test("em",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("em",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))
     
test("setCode",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("unsetCode",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))
test("code",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("code",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))

test("joinBackward",
     doc(p("hi"), p("<a>there")),
     doc(p("hithere")))
test("joinBackward",
     doc(p("hi"), blockquote(p("<a>there"))),
     doc(p("hi"), p("there")))
test("joinBackward",
     doc(blockquote(p("hi")), blockquote(p("<a>there"))),
     doc(blockquote(p("hi"), p("there"))))
test("joinBackward",
     doc(blockquote(p("hi")), p("<a>there")),
     doc(blockquote(p("hi"), p("there"))))
test("joinBackward",
     doc(blockquote(p("hi")), p("<a>there"), blockquote(p("x"))),
     doc(blockquote(p("hi"), p("there"), p("x"))))
test("joinBackward",
     doc(ul(li(p("hi"))), p("<a>there")),
     doc(ul(li(p("hi")), li(p("there")))))
test("joinBackward",
     doc(ul(li(p("hi"))), ul(li(p("<a>there")))),
     doc(ul(li(p("hi")), li(p("there")))))
test("joinBackward",
     doc(ul(li(p("hi")), li(p("<a>there")))),
     doc(ul(li(p("hi"), p("there")))))
test("joinBackward",
     doc(ul(li(p("<a>there")))),
     doc(p("<a>there")))
test("joinBackward",
     doc(ul(li(p("hi"))), p("<a>there"), ul(li(p("x")))),
     doc(ul(li(p("hi")), li(p("there")), li(p("x")))))
test("joinBackward",
     doc(hr, p("<a>there")),
     doc(p("there")))
test("joinBackward",
     doc(hr, blockquote(p("<a>there"))),
     doc(blockquote(p("there"))))
test("joinBackward",
     doc(p("<a>foo")),
     doc(p("foo")))

test("deleteSelection",
     doc(p("f<a>o<b>o")),
     doc(p("fo")))
test("deleteSelection",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("fr")))

test("deleteCharBefore",
     doc(p("ba<a>r")),
     doc(p("br")))
test("deleteCharBefore",
     doc(p("fç̀<a>o")), // The c has two combining characters, which must be deleted along with it
     doc(p("fo")))
test("deleteCharBefore",
     doc(p("çç<a>ç")), // The combining characters in nearby characters must be left alone
     doc(p("çç")))
test("deleteCharBefore",
     doc(p("😅😆<a>😇😈")), // Must delete astral plane characters as one unit
     doc(p("😅😇😈")))

test("deleteWordBefore",
     doc(p("foo bar <a>baz")),
     doc(p("foo baz")))
test("deleteWordBefore",
     doc(p("foo bar<a> baz")),
     doc(p("foo  baz")))
test("deleteWordBefore",
     doc(p("foo ...<a>baz")),
     doc(p("foo baz")))
test("deleteWordBefore",
     doc(p("<a>foo")),
     doc(p("foo")))
test("deleteWordBefore",
     doc(p("foo   <a>bar")),
     doc(p("foobar")))

test("joinForward",
     doc(p("foo<a>"), p("bar")),
     doc(p("foobar")))
test("joinForward",
     doc(p("foo<a>")),
     doc(p("foo")))
test("joinForward",
     doc(p("foo<a>"), hr, p("bar")),
     doc(p("foo"), p("bar")))
test("joinForward",
     doc(ul(li(p("a<a>")), li(p("b")))),
     doc(ul(li(p("a"), p("b")))))
test("joinForward",
     doc(ul(li(p("a<a>"), p("b")))),
     doc(ul(li(p("ab")))))
test("joinForward",
     doc(blockquote(p("foo<a>")), p("bar")),
     doc(blockquote(p("foo<a>"), p("bar"))))
test("joinForward",
     doc(blockquote(p("hi<a>")), blockquote(p("there"))),
     doc(blockquote(p("hi"), p("there"))))
test("joinForward",
     doc(p("foo<a>"), blockquote(p("bar"))),
     doc(p("foo"), p("bar")))
test("joinForward",
     doc(ul(li(p("hi<a>"))), ul(li(p("there")))),
     doc(ul(li(p("hi")), li(p("there")))))
test("joinForward",
     doc(ul(li(p("there<a>")))),
     doc(ul(li(p("there")))))
test("joinForward",
     doc(blockquote(p("there<a>")), hr),
     doc(blockquote(p("there"))))

test("deleteCharAfter",
     doc(p("b<a>ar")),
     doc(p("br")))
test("deleteCharAfter",
     doc(p("f<a>ç̀o")), // The c has two combining characters, which must be deleted along with it
     doc(p("fo")))
test("deleteCharAfter",
     doc(p("ç<a>çç")), // The combining characters in nearby characters must be left alone
     doc(p("çç")))
test("deleteCharAfter",
     doc(p("😅😆<a>😇😈")), // Must delete astral plane characters as one unit
     doc(p("😅😆😈")))

test("deleteWordAfter",
     doc(p("foo<a> bar baz")),
     doc(p("foo baz")))
test("deleteWordAfter",
     doc(p("foo <a>bar baz")),
     doc(p("foo  baz")))
test("deleteWordAfter",
     doc(p("foo<a>... baz")),
     doc(p("foo baz")))
test("deleteWordAfter",
     doc(p("foo<a>")),
     doc(p("foo")))
test("deleteWordAfter",
     doc(p("fo<a>o")),
     doc(p("fo")))
test("deleteWordAfter",
     doc(p("foo<a>   bar")),
     doc(p("foobar")))

test("joinUp",
     doc(blockquote(p("foo")), blockquote(p("<a>bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))
test("joinUp",
     doc(blockquote(p("<a>foo")), blockquote(p("bar"))),
     doc(blockquote(p("foo")), blockquote(p("bar"))))
test("joinUp",
     doc(ul(li(p("foo"))), ul(li(p("<a>bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("joinUp",
     doc(ul(li(p("foo")), li(p("<a>bar")))),
     doc(ul(li(p("foo"), p("bar")))))
test("joinUp",
     doc(ul(li(p("foo")), li("<a>", p("bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("joinUp",
     doc(ul(li(p("foo")), "<a>", li(p("bar")))),
     doc(ul(li(p("foo"), p("bar")))))

test("joinDown",
     doc(blockquote(p("foo<a>")), blockquote(p("bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))
test("joinDown",
     doc(blockquote(p("foo")), blockquote(p("<a>bar"))),
     doc(blockquote(p("foo")), blockquote(p("bar"))))
test("joinDown",
     doc(ul(li(p("foo<a>"))), ul(li(p("bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("joinDown",
     doc(ul(li(p("<a>foo")), li(p("bar")))),
     doc(ul(li(p("foo"), p("bar")))))
test("joinDown",
     doc(ul(li("<a>", p("foo")), li(p("bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("joinDown",
     doc(ul("<a>", li(p("foo")), li(p("bar")))),
     doc(ul(li(p("foo"), p("bar")))))

test("lift",
     doc(blockquote(p("<a>foo"))),
     doc(p("foo")))
test("lift",
     doc(blockquote(p("foo"), p("<a>bar"), p("baz"))),
     doc(blockquote(p("foo")), p("bar"), blockquote(p("baz"))))
test("lift",
     doc(ul(li(p("<a>foo")))),
     doc(p("foo")))
test("lift",
     doc(p("<a>foo")),
     doc(p("foo")))
test("lift",
     doc(blockquote(ul(li(p("foo<a>"))))),
     doc(blockquote(p("foo<a>"))))
test("lift",
     doc(blockquote("<a>", ul(li(p("foo"))))),
     doc(ul(li(p("foo")))))

test("wrapBulletList",
     doc(p("<a>foo")),
     doc(ul(li(p("foo")))))
test("wrapBulletList",
     doc(blockquote(p("<a>foo"))),
     doc(blockquote(ul(li(p("foo"))))))
test("wrapBulletList",
     doc(p("foo"), p("ba<a>r"), p("ba<b>z")),
     doc(p("foo"), ul(li(p("bar")), li(p("baz"))))) 
test("wrapBulletList",
     doc(ul(li(p("<a>foo")))),
     doc(ul(li(p("foo")))))
test("wrapBulletList",
     doc(ol(li(p("<a>foo")))),
     doc(ol(li(p("foo")))))
test("wrapBulletList",
     doc(ul(li(p("foo"), p("<a>bar")))),
     doc(ul(li(p("foo"), ul(li(p("bar")))))))
test("wrapBulletList",
     doc(ul(li(p("foo")), li(p("<a>bar")), li(p("baz")))),
     doc(ul(li(p("foo"), ul(li(p("bar")))), li(p("baz")))))

test("wrapOrderedList",
     doc(p("<a>foo")),
     doc(ol(li(p("foo")))))
test("wrapOrderedList",
     doc(blockquote(p("<a>foo"))),
     doc(blockquote(ol(li(p("foo"))))))
test("wrapOrderedList",
     doc(p("foo"), p("ba<a>r"), p("ba<b>z")),
     doc(p("foo"), ol(li(p("bar")), li(p("baz")))))
test("wrapBlockQuote",
     doc(p("fo<a>o")),
     doc(blockquote(p("foo"))))
test("wrapBlockQuote",
     doc(p("fo<a>o"), p("bar"), p("ba<b>z"), p("quux")),
     doc(blockquote(p("foo"), p("bar"), p("baz")), p("quux")))
test("wrapBlockQuote",
     doc(blockquote(p("fo<a>o"))),
     doc(blockquote(blockquote(p("foo")))))
test("wrapBlockQuote",
     doc("<a>", ul(li(p("foo")))),
     doc(blockquote(ul(li(p("foo"))))))

test("splitBlock",
     doc(p("foo<a>")),
     doc(p("foo"), p()))
test("splitBlock",
     doc(p("foo<a>bar")),
     doc(p("foo"), p("bar")))
test("splitBlock",
     doc(h1("foo<a>")),
     doc(h1("foo"), p()))
test("splitBlock",
     doc(h1("foo<a>bar")),
     doc(h1("foo"), h1("bar")))
test("splitBlock",
     doc(p("fo<a>ob<b>ar")),
     doc(p("fo"), p("ar")))
test("splitBlock",
     doc(ol(li(p("a")), "<a>", li(p("b")), li(p("c")))),
     doc(ol(li(p("a"))), ol(li(p("b")), li(p("c")))))
test("splitBlock",
     doc(ol("<a>", li(p("a")), li(p("b")), li(p("c")))),
     doc(ol(li(p("a")), li(p("b")), li(p("c")))))

test("splitListItem",
     doc(p("foo<a>bar")),
     doc(p("foobar")))
test("splitListItem",
     doc("<a>", p("foobar")),
     doc(p("foobar")))
test("splitListItem",
     doc(ul(li(p("foo<a>bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("splitListItem",
     doc(ul(li(p("foo<a>ba<b>r")))),
     doc(ul(li(p("foo")), li(p("r")))))

test("newlineInCode",
     doc(pre("foo<a>bar")),
     doc(pre("foo\nbar")))

test("liftEmptyBlock",
     doc(blockquote(p("foo"), p("<a>"))),
     doc(blockquote(p("foo")), blockquote(p())))
test("liftEmptyBlock",
     doc(blockquote(p("foo")), blockquote(p("<a>"))),
     doc(blockquote(p("foo")), p("<a>")))
test("liftEmptyBlock",
     doc(ul(li(p("hi"), p("<a>")))),
     doc(ul(li(p("hi")), li(p("<a>")))))
test("liftEmptyBlock",
     doc(ul(li(p("hi")), li(p("<a>")))),
     doc(ul(li(p("hi"))), p()))

test("createParagraphNear",
     doc("<a>", hr),
     doc(p(), hr))
test("createParagraphNear",
     doc(p(), "<a>", hr),
     doc(p(), hr, p()))

test("makeH1",
     doc(p("fo<a>o")),
     doc(h1("foo")))
test("makeH1",
     doc(pre("fo<a>o")),
     doc(h1("foo")))

test("makeParagraph",
     doc(h1("fo<a>o")),
     doc(p("foo")))
test("makeParagraph",
     doc(h1("fo<a>o", em("bar"))),
     doc(p("foo", em("bar"))))
test("makeParagraph",
     doc("<a>", h1("foo")),
     doc(p("foo")))

test("makeCodeBlock",
     doc(h1("fo<a>o")),
     doc(pre("foo")))
test("makeCodeBlock",
     doc(p("fo<a>o", em("bar"))),
     doc(pre("foobar")))

test("insertHorizontalRule",
     doc(p("<a>foo")),
     doc(hr, p("foo")))
test("insertHorizontalRule",
     doc(p("foo"), p("<a>bar")),
     doc(p("foo"), hr, p("bar")))
test("insertHorizontalRule",
     doc(p("foo"), p("b<a>ar")),
     doc(p("foo"), p("b"), hr, p("ar")))
test("insertHorizontalRule",
     doc(p("fo<a>o"), p("b<b>ar")),
     doc(p("fo"), hr, p("ar")))
test("insertHorizontalRule",
     doc("<a>", p("foo"), p("bar")),
     doc(hr, p("bar")))
test("insertHorizontalRule",
     doc("<a>", p("bar")),
     doc(hr))

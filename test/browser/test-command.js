import {defTest} from "../tests"
import {tempEditor} from "./def"
import {cmpNode} from "../cmp"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"

import {Range} from "../../src/edit/selection"

const used = Object.create(null)

function test(cmd, before, after) {
  let known = used[cmd] || 0
  defTest("command_" + cmd + (known ? "_" + (known + 1) : ""), () => {
    let pm = tempEditor({doc: before})
    pm.setSelection(new Range(before.tag.a, before.tag.b || before.tag.a))
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
     doc(p("hithere")))
test("joinBackward",
     doc(blockquote(p("hi")), blockquote(p("<a>there"))),
     doc(blockquote(p("hi"), p("there"))))
test("joinBackward",
     doc(blockquote(p("hi")), p("<a>there")),
     doc(blockquote(p("hi"), p("there"))))
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

test("delForward",
     doc(p("f<a>o<b>o")),
     doc(p("fo")))
test("delForward",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("fr")))
test("delForward",
     doc(p("b<a>ar")),
     doc(p("br")))
test("delForward",
     doc(p("foo<a>"), p("bar")),
     doc(p("foobar")))
test("delForward",
     doc(p("foo<a>")),
     doc(p("foo")))
test("delForward",
     doc(p("foo<a>"), hr, p("bar")),
     doc(p("foo"), p("bar")))
test("delForward",
     doc(ul(li(p("a<a>")), li(p("b")))),
     doc(ul(li(p("ab")))))
test("delForward",
     doc(p("f<a>ç̀o")), // The c has two combining characters, which must be deleted along with it
     doc(p("fo")))
test("delForward",
     doc(p("ç<a>çç")), // The combining characters in nearby characters must be left alone
     doc(p("çç")))
test("delForward",
     doc(p("😅😆<a>😇😈")), // Must delete astral plane characters as one unit
     doc(p("😅😆😈")))

test("delWordForward",
     doc(p("foo<a> bar baz")),
     doc(p("foo baz")))
test("delWordForward",
     doc(p("foo <a>bar baz")),
     doc(p("foo  baz")))
test("delWordForward",
     doc(p("foo<a>... baz")),
     doc(p("foo baz")))
test("delWordForward",
     doc(p("foo<a>")),
     doc(p("foo")))
test("delWordForward",
     doc(p("fo<a>o")),
     doc(p("fo")))
test("delWordForward",
     doc(p("foo<a>   bar")),
     doc(p("foobar")))

test("join",
     doc(blockquote(p("foo")), blockquote(p("<a>bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))
test("join",
     doc(blockquote(p("<a>foo")), blockquote(p("bar"))),
     doc(blockquote(p("foo")), blockquote(p("bar"))))
test("join",
     doc(ul(li(p("foo"))), ul(li(p("<a>bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("join",
     doc(ul(li(p("foo")), li(p("<a>bar")))),
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

test("wrapBulletList",
     doc(p("<a>foo")),
     doc(ul(li(p("foo")))))
test("wrapBulletList",
     doc(ul(li(p("<a>foo")))),
     doc(ul(li(ul(li(p("foo")))))))
test("wrapBulletList",
     doc(p("foo"), p("ba<a>r"), p("ba<b>z")),
     doc(p("foo"), ul(li(p("bar")), li(p("baz"))))) 

test("wrapOrderedList",
     doc(p("<a>foo")),
     doc(ol(li(p("foo")))))
test("wrapOrderedList",
     doc(ol(li(p("<a>foo")))),
     doc(ol(li(ol(li(p("foo")))))))
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

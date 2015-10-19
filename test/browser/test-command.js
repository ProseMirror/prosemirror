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

test("toggleStrong",
     doc(p("f<a>o<b>o")),
     doc(p("f", strong("o"), "o")))
test("toggleStrong",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f"), "o", strong("o"))))
test("toggleStrong",
     doc(p("f<a>oo ", strong("ba<b>r"))),
     doc(p("foo ba", strong("r"))))

test("setEm",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("unsetEm",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))
test("toggleEm",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("toggleEm",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))
     
test("setCode",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("unsetCode",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))
test("toggleCode",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("toggleCode",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))

test("delBackward",
     doc(p("f<a>o<b>o")),
     doc(p("fo")))
test("delBackward",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("fr")))
test("delBackward",
     doc(p("ba<a>r")),
     doc(p("br")))
test("delBackward",
     doc(p("foo"), p("<a>bar")),
     doc(p("foobar")))
test("delBackward",
     doc(p("<a>foo")),
     doc(p("foo")))
test("delBackward",
     doc(p("foo"), hr, p("<a>bar")),
     doc(p("foo"), p("bar")))
test("delBackward",
     doc(ul(li(p("a")), li(p("<a>b")))),
     doc(ul(li(p("a"), p("<a>b")))))
test("delBackward",
     doc(blockquote(p("<a>foo"))),
     doc(p("foo")))
test("delBackward",
     doc(blockquote(p("foo"), p("<a>bar"), p("baz"))),
     doc(blockquote(p("foo")), p("<a>bar"), blockquote(p("baz"))))
test("delBackward",
     doc(p("fç̀<a>o")), // The c has two combining characters, which must be deleted along with it
     doc(p("fo")))
test("delBackward",
     doc(p("çç<a>ç")), // The combining characters in nearby characters must be left alone
     doc(p("çç")))
test("delBackward",
     doc(p("😅😆<a>😇😈")), // Must delete astral plane characters as one unit
     doc(p("😅😇😈")))

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

test("delWordBackward",
     doc(p("foo bar <a>baz")),
     doc(p("foo baz")))
test("delWordBackward",
     doc(p("foo bar<a> baz")),
     doc(p("foo  baz")))
test("delWordBackward",
     doc(p("foo ...<a>baz")),
     doc(p("foo baz")))
test("delWordBackward",
     doc(p("<a>foo")),
     doc(p("foo")))
test("delWordBackward",
     doc(p("foo   <a>bar")),
     doc(p("foobar")))

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
test("wrapBlockquote",
     doc(p("fo<a>o")),
     doc(blockquote(p("foo"))))
test("wrapBlockquote",
     doc(p("fo<a>o"), p("bar"), p("ba<b>z"), p("quux")),
     doc(blockquote(p("foo"), p("bar"), p("baz")), p("quux")))
test("wrapBlockquote",
     doc(blockquote(p("fo<a>o"))),
     doc(blockquote(blockquote(p("foo")))))

test("endBlock",
     doc(p("foo<a>")),
     doc(p("foo"), p()))
test("endBlock",
     doc(p("foo<a>bar")),
     doc(p("foo"), p("bar")))
test("endBlock",
     doc(h1("foo<a>")),
     doc(h1("foo"), p()))
test("endBlock",
     doc(h1("foo<a>bar")),
     doc(h1("foo"), h1("bar")))
test("endBlock",
     doc(pre("foo<a>bar")),
     doc(pre("foo\nbar")))
test("endBlock",
     doc(p("fo<a>ob<b>ar")),
     doc(p("fo"), p("ar")))
test("endBlock",
     doc(blockquote(p("foo"), p("<a>"))),
     doc(blockquote(p("foo")), p()))

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

test("insertRule",
     doc(p("<a>foo")),
     doc(hr, p("foo")))
test("insertRule",
     doc(p("foo"), p("<a>bar")),
     doc(p("foo"), hr, p("bar")))
test("insertRule",
     doc(p("foo"), p("b<a>ar")),
     doc(p("foo"), p("b"), hr, p("ar")))
test("insertRule",
     doc(p("fo<a>o"), p("b<b>ar")),
     doc(p("fo"), hr, p("ar")))

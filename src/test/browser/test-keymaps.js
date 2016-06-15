const {defTest} = require("../tests")
const {tempEditor, dispatch} = require("./def")
const {cmpNode} = require("../cmp")
const {doc, blockquote, pre, h1, h2, p, li, ul, em, strong, code, br, hr} = require("../build")

const {buildKeymap} = require("../../example-setup")
const Keymap = require("browserkeymap")

function test(key, before, after) {
  defTest("keymap_" + key, () => {
    let pm = tempEditor({doc: before})
    pm.addKeymap(buildKeymap(pm.schema))
    dispatch(pm, Keymap.normalizeKeyName(key.split("_")[0]))
    cmpNode(pm.doc, after)
  })
}

test("Mod-Enter_simple",
     doc(p("fo<a>o")),
     doc(p("fo", br, "o")))
test("Mod-Enter_in_code",
     doc(pre("fo<a>o")),
     doc(pre("fo\no")))

test("Mod-B_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", strong("o"), "o")))
test("Mod-B_no_selection",
     doc(p("f<a>oo")),
     doc(p("foo")))
test("Mod-B_across_textblocks",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("f", strong("oo")), p(strong("ba"), "r")))
test("Mod-B_unset",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f"), "o", strong("o"))))
test("Mod-B_unset_across_textblocks",
     doc(p("f<a>oo ", strong("ba<b>r"))),
     doc(p("foo ba", strong("r"))))

test("Mod-I_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("Mod-I_unset",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))

test("Ctrl-`_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("Ctrl-`_unset",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))

test("Backspace_join",
     doc(p("hi"), p("<a>there")),
     doc(p("hithere")))
test("Backspace_del_char",
     doc(p("hi<a>")),
     doc(p("h")))
test("Backspace_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Mod-Backspace_join",
     doc(p("hi"), p("<a>there")),
     doc(p("hithere")))
test("Mod-Backspace_del_word",
     doc(p("one two<a> three")),
     doc(p("one  three")))
test("Mod-Backspace_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Delete_join",
     doc(p("hi<a>"), p("there")),
     doc(p("hithere")))
test("Delete_del_char",
     doc(p("<a>hi")),
     doc(p("i")))
test("Delete_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Alt-Up",
     doc(blockquote(p("foo")), blockquote(p("<a>bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))
test("Alt-Down",
     doc(blockquote(p("foo<a>")), blockquote(p("bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))

test("Shift-Ctrl--_at_start",
     doc(p("<a>foo")),
     doc(hr, p("foo")))
test("Shift-Ctrl--_before",
     doc(p("foo"), p("<a>bar")),
     doc(p("foo"), hr, p("bar")))
test("Shift-Ctrl--_after",
     doc(p("foo<a>")),
     doc(p("foo"), hr))
test("Shift-Ctrl--_inside",
     doc(p("foo"), p("b<a>ar")),
     doc(p("foo"), p("b"), hr, p("ar")))
test("Shift-Ctrl--_overwrite",
     doc(p("fo<a>o"), p("b<b>ar")),
     doc(p("fo"), hr, p("ar")))
test("Shift-Ctrl--_selected_node",
     doc("<a>", p("foo"), p("bar")),
     doc(hr, p("bar")))
test("Shift-Ctrl--_only_selected_node",
     doc("<a>", p("bar")),
     doc(hr))

test("Mod-]",
     doc(ul(li(p("one")), li(p("t<a><b>wo")), li(p("three")))),
     doc(ul(li(p("one"), ul(li(p("two")))), li(p("three")))))
test("Mod-[",
     doc(ul(li(p("hello"), ul(li(p("o<a><b>ne")), li(p("two")))))),
     doc(ul(li(p("hello")), li(p("one"), ul(li(p("two")))))))

test("Shift-Ctrl-0",
     doc(h1("fo<a>o")),
     doc(p("foo")))
test("Shift-Ctrl-1",
     doc(p("fo<a>o")),
     doc(h1("foo")))
test("Shift-Ctrl-2",
     doc(pre("fo<a>o")),
     doc(h2("foo")))

test("Enter_split",
     doc(p("ab<a>c")),
     doc(p("ab"), p("c")))
test("Enter_split_delete",
     doc(p("ab<a>foo<b>c")),
     doc(p("ab"), p("c")))
test("Enter_lift",
     doc(blockquote(p("<a>"))),
     doc(p()))
test("Enter_code_newline",
     doc(pre("foo<a>bar")),
     doc(pre("foo\nbar")))

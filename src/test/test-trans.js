const {schema} = require("../schema-basic")

const {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, img, img2, dataImage, br, hr} = require("./build")

const {defTest} = require("./tests")
const {tr, testTransform} = require("./trans")

function add(name, doc, expect, mark) {
  defTest("addMark_" + name, () => testTransform(tr.addMark(mark), doc, expect))
}

add("simple",
    doc(p("hello <a>there<b>!")),
    doc(p("hello ", strong("there"), "!")),
    "strong")
add("double_bold",
    doc(p("hello ", strong("<a>there"), "!<b>")),
    doc(p("hello ", strong("there!"))),
    "strong")
add("overlap",
    doc(p("one <a>two ", em("three<b> four"))),
    doc(p("one ", strong("two ", em("three")), em(" four"))),
    "strong")
add("overwrite_link",
    doc(p("this is a ", a("<a>link<b>"))),
    doc(p("this is a ", a2("link"))),
    schema.mark("link", {href: "http://bar"}))
add("code",
    doc(p("before"), blockquote(p("the variable is called <a>i<b>")), p("after")),
    doc(p("before"), blockquote(p("the variable is called ", code("i"))), p("after")),
    "code")
add("across_blocks",
    doc(p("hi <a>this"), blockquote(p("is")), p("a docu<b>ment"), p("!")),
    doc(p("hi ", em("this")), blockquote(p(em("is"))), p(em("a docu"), "ment"), p("!")),
    "em")

function rem(name, doc, expect, mark) {
  defTest("rmMark_" + name, () => testTransform(tr.rmMark(mark), doc, expect))
}

rem("gap",
    doc(p(em("hello <a>world<b>!"))),
    doc(p(em("hello "), "world", em("!"))),
    "em")
rem("nothing_there",
    doc(p(em("hello"), " <a>world<b>!")),
    doc(p(em("hello"), " <a>world<b>!")),
    "em")
rem("from_nested",
    doc(p(em("one ", strong("<a>two<b>"), " three"))),
    doc(p(em("one two three"))),
    "strong")
rem("unlink",
    doc(p("<a>hello ", a("link<b>"))),
    doc(p("hello link")),
    schema.mark("link", {href: "http://foo"}))
rem("other_link",
    doc(p("hello ", a("link"))),
    doc(p("hello ", a("link"))),
    schema.mark("link", {href: "http://bar"}))
rem("across_blocks",
    doc(blockquote(p(em("much <a>em")), p(em("here too"))), p("between", em("...")), p(em("end<b>"))),
    doc(blockquote(p(em("much "), "em"), p("here too")), p("between..."), p("end")),
    "em")
rem("all",
    doc(p("<a>hello, ", em("this is ", strong("much"), " ", a("markup<b>")))),
    doc(p("<a>hello, this is much markup")),
    null)

function ins(name, doc, expect, nodes) {
  defTest("insert_" + name, () => testTransform(tr.ins(nodes), doc, expect))
}

ins("break",
    doc(p("hello<a>there")),
    doc(p("hello", br, "<a>there")),
    schema.node("hard_break"))
ins("simple",
    doc(p("one"), "<a>", p("two<2>")),
    doc(p("one"), p(), "<a>", p("two<2>")),
    schema.node("paragraph"))
ins("two",
    doc(p("one"), "<a>", p("two<2>")),
    doc(p("one"), p("hi"), hr, "<a>", p("two<2>")),
    [schema.node("paragraph", null, [schema.text("hi")]),
     schema.node("horizontal_rule")])
ins("end_of_blockquote",
    doc(blockquote(p("he<before>y"), "<a>"), p("after<after>")),
    doc(blockquote(p("he<before>y"), p()), p("after<after>")),
    schema.node("paragraph"))
ins("start_of_blockquote",
    doc(blockquote("<a>", p("he<1>y")), p("after<2>")),
    doc(blockquote(p(), "<a>", p("he<1>y")), p("after<2>")),
    schema.node("paragraph"))

function del(name, doc, expect) {
  defTest("delete_" + name, () => testTransform(tr.del(), doc, expect))
}

del("simple",
    doc(p("<1>one"), "<a>", p("tw<2>o"), "<b>", p("<3>three")),
    doc(p("<1>one"), "<a><2>", p("<3>three")))
del("only_child",
    doc(blockquote("<a>", p("hi"), "<b>"), p("x")),
    doc(blockquote(p()), p("x")))
del("outside_path",
    doc(blockquote(p("a"), "<a>", p("b"), "<b>"), p("c<1>")),
    doc(blockquote(p("a")), p("c<1>")))
del("across_code_block",
    doc(pre("fo<a>o"), p("b<b>ar", img)),
    doc(pre("fo"), p("ar", img)))

function txt(name, doc, expect, text) {
  defTest("insertText_" + name, () => testTransform(tr.txt(text), doc, expect))
}

txt("inherit_style",
    doc(p(em("he<a>lo"))),
    doc(p(em("hello"))),
    "l")
txt("simple",
    doc(p("hello<a>")),
    doc(p("hello world<a>")),
    " world")
txt("simple_inside",
    doc(p("he<a>llo")),
    doc(p("hej<a>llo")),
     "j")
txt("left_associative",
    doc(p(em("hello<a>"), " world<after>")),
    doc(p(em("hello big"), " world<after>")),
    " big")
txt("paths",
    doc(p("<1>before"), p("<2>here<a>"), p("after<3>")),
    doc(p("<1>before"), p("<2>here!<a>"), p("after<3>")),
    "!")
txt("at_start",
    doc(p("<a>one")),
    doc(p("two <a>one")),
    "two ")
txt("after br",
    doc(p("hello", br, "<a>you")),
    doc(p("hello", br, "...you")),
    "...")
txt("after_br_nojoin",
    doc(p("hello", br, em("<a>you"))),
    doc(p("hello", br, "...<a>", em("you"))),
    "...")
txt("before_br",
    doc(p("<a>", br, "ok")),
    doc(p("ay", br, "ok")),
    "ay")

function join(name, doc, expect) {
  defTest("join_" + name, () => testTransform(tr.join(), doc, expect))
}

join("simple",
     doc(blockquote(p("<before>a")), "<a>", blockquote(p("b")), p("after<after>")),
     doc(blockquote(p("<before>a"), "<a>", p("b")), p("after<after>")))
join("different",
     doc(h1("foo"), "<a>", p("bar")),
     doc(h1("foobar")))
join("deeper",
     doc(blockquote(blockquote(p("a"), p("b<before>")), "<a>", blockquote(p("c"), p("d<after>")))),
     doc(blockquote(blockquote(p("a"), p("b<before>"), "<a>", p("c"), p("d<after>")))))
join("lists",
     doc(ol(li(p("one")), li(p("two"))), "<a>", ol(li(p("three")))),
     doc(ol(li(p("one")), li(p("two")), "<a>", li(p("three")))))
join("list_item",
     doc(ol(li(p("one")), li(p("two")), "<a>", li(p("three")))),
     doc(ol(li(p("one")), li(p("two"), "<a>", p("three")))))
join("inline",
     doc(p("foo"), "<a>", p("bar")),
     doc(p("foo<a>bar")))

function split(name, doc, expect, args) {
  defTest("split_" + name, () => {
    let {depth, type, attrs} = args || {}
    testTransform(tr.split("a", depth, type, attrs), doc, expect)
  })
}

split("simple",
      doc(p("foo<a>bar")),
      doc(p("foo"), p("<a>bar")))
split("before_and_after",
      doc(p("<1>a"), p("<2>foo<a>bar<3>"), p("<4>b")),
      doc(p("<1>a"), p("<2>foo"), p("<a>bar<3>"), p("<4>b")))
split("deeper",
      doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
      doc(blockquote(blockquote(p("foo")), blockquote(p("<a>bar"))), p("after<1>")),
      {depth: 2})
split("and_deeper",
      doc(blockquote(blockquote(p("foo<a>bar"))), p("after<1>")),
      doc(blockquote(blockquote(p("foo"))), blockquote(blockquote(p("<a>bar"))), p("after<1>")),
      {depth: 3})
split("at_end",
      doc(blockquote(p("hi<a>"))),
      doc(blockquote(p("hi"), p("<a>"))))
split("at_start",
      doc(blockquote(p("<a>hi"))),
      doc(blockquote(p(), p("<a>hi"))))
split("list_paragraph",
      doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
      doc(ol(li(p("one<1>")), li(p("two"), p("<a>three")), li(p("four<2>")))))
split("list_item",
      doc(ol(li(p("one<1>")), li(p("two<a>three")), li(p("four<2>")))),
      doc(ol(li(p("one<1>")), li(p("two")), li(p("<a>three")), li(p("four<2>")))),
      {depth: 2})
split("change_type",
      doc(h1("hell<a>o!")),
      doc(h1("hell"), p("<a>o!")),
      {type: "paragraph"})
split("blockquote_start",
      doc(blockquote("<a>", p("x"))),
      "fail")
split("blockquote_end",
      doc(blockquote(p("x"), "<a>")),
      "fail")

function lift(name, doc, expect) {
  defTest("lift_" + name, () => testTransform(tr.lift(), doc, expect))
}

lift("simple_between",
     doc(blockquote(p("<before>one"), p("<a>two"), p("<after>three"))),
     doc(blockquote(p("<before>one")), p("<a>two"), blockquote(p("<after>three"))))
lift("simple_at_front",
     doc(blockquote(p("<a>two"), p("<after>three"))),
     doc(p("<a>two"), blockquote(p("<after>three"))))
lift("simple_at_end",
     doc(blockquote(p("<before>one"), p("<a>two"))),
     doc(blockquote(p("<before>one")), p("<a>two")))
lift("simple_alone",
     doc(blockquote(p("<a>t<in>wo"))),
     doc(p("<a>t<in>wo")))
lift("multiple",
     doc(blockquote(blockquote(p("on<a>e"), p("tw<b>o")), p("three"))),
     doc(blockquote(p("on<a>e"), p("tw<b>o"), p("three"))))
lift("multiple_lopsided",
     doc(p("start"), blockquote(blockquote(p("a"), p("<a>b")), p("<b>c"))),
     doc(p("start"), blockquote(p("a"), p("<a>b")), p("<b>c")))
lift("deeper",
     doc(blockquote(blockquote(p("<1>one"), p("<a>two"), p("<3>three"), p("<b>four"), p("<5>five")))),
     doc(blockquote(blockquote(p("<1>one")), p("<a>two"), p("<3>three"), p("<b>four"), blockquote(p("<5>five")))))
lift("from_list",
     doc(ul(li(p("one")), li(p("two<a>")), li(p("three")))),
     doc(ul(li(p("one"))), p("two<a>"), ul(li(p("three")))))
lift("end_of_list",
     doc(ul(li(p("a")), li(p("b<a>")), "<1>")),
     doc(ul(li(p("a"))), p("b<a>"), "<1>"))

function wrap(name, doc, expect, type, attrs) {
  defTest("wrap_" + name, () => testTransform(tr.wrap(type, attrs), doc, expect))
}

wrap("simple",
     doc(p("one"), p("<a>two"), p("three")),
     doc(p("one"), blockquote(p("<a>two")), p("three")),
     "blockquote")
wrap("two",
     doc(p("one<1>"), p("<a>two"), p("<b>three"), p("four<4>")),
     doc(p("one<1>"), blockquote(p("<a>two"), p("three")), p("four<4>")),
     "blockquote")
wrap("list",
     doc(p("<a>one"), p("<b>two")),
     doc(ol(li(p("<a>one"), p("<b>two")))),
     "ordered_list")
wrap("nested_list",
     doc(ol(li(p("<1>one")), li(p("..."), p("<a>two"), p("<b>three")), li(p("<4>four")))),
     doc(ol(li(p("<1>one")), li(p("..."), ol(li(p("<a>two"), p("<b>three")))), li(p("<4>four")))),
     "ordered_list")
wrap("include_parent",
     doc(blockquote(p("<1>one"), p("two<a>")), p("three<b>")),
     doc(blockquote(blockquote(p("<1>one"), p("two<a>")), p("three<b>"))),
     "blockquote")
wrap("bullet_list",
     doc(p("x"), p("yyyy<a>y"), p("z")),
     doc(p("x"), ul(li(p("yyyy<a>y"))), p("z")),
     "bullet_list")

function type(name, doc, expect, nodeType, attrs) {
  defTest("blockType_" + name, () => testTransform(tr.blockType(nodeType, attrs), doc, expect))
}

type("simple",
     doc(p("am<a> i")),
     doc(h2("am i")),
     "heading", {level: 2})
type("multiple",
     doc(h1("<a>hello"), p("there"), p("<b>you"), p("end")),
     doc(pre("hello"), pre("there"), pre("you"), p("end")),
     "code_block")
type("inside",
     doc(blockquote(p("one<a>"), p("two<b>"))),
     doc(blockquote(h1("one<a>"), h1("two<b>"))),
     "heading", {level: 1})
type("clear_markup",
     doc(p("hello<a> ", em("world"))),
     doc(pre("hello world")),
     "code_block")
type("only_clear_for_code_block",
     doc(p("hello<a> ", em("world"))),
     doc(h1("hello<a> ", em("world"))),
     "heading", {level: 1})

function nodeType(name, doc, expect, type, attrs) {
  defTest("nodeType_" + name, () => testTransform(tr.nodeType(type, attrs), doc, expect))
}

nodeType("valid",
         doc("<a>", p("foo")),
         doc(h1("foo")),
         "heading", {level: 1})
nodeType("inline",
         doc(p("foo<a>", img, "bar")),
         doc(p("foo", img2, "bar")),
         "image", {src: dataImage, alt: "y"})

function repl(name, doc, source, expect) {
  defTest("replace_" + name, () => {
    testTransform(tr.repl(source ? source.slice(source.tag.a, source.tag.b) : undefined), doc, expect)
  })
}

repl("del_text",
     doc(p("hell<a>o y<b>ou")),
     null,
     doc(p("hell<a><b>ou")))
repl("del_join",
     doc(p("hell<a>o"), p("y<b>ou")),
     null,
     doc(p("hell<a><b>ou")))
repl("del_deeper_left",
     doc(blockquote(p("ab<a>c")), "<b>", p("def")),
     null,
     doc(blockquote(p("ab<a>")), "<b>", p("def")))
repl("del_deeper_right",
     doc(p("abc"), "<a>", blockquote(p("d<b>ef"))),
     null,
     doc(p("abc"), "<a>", blockquote(p("<b>ef"))))

repl("overwrite_text",
     doc(p("hell<a>o y<b>ou")),
     doc(p("<a>i k<b>")),
     doc(p("hell<a>i k<b>ou")))
repl("insert_text",
     doc(p("hell<a><b>o")),
     doc(p("<a>i k<b>")),
     doc(p("helli k<a><b>o")))
repl("add_paragraph",
     doc(p("hello<a>you")),
     doc("<a>", p("there"), "<b>"),
     doc(p("hello"), p("there"), p("<a>you")))

repl("join_text",
     doc(h1("he<a>llo"), p("arg<b>!")),
     doc(p("1<a>2<b>3")),
     doc(h1("he2!")))
repl("match_list",
     doc(ol(li(p("one<a>")), li(p("three")))),
     doc(ol(li(p("<a>half")), li(p("two")), "<b>")),
     doc(ol(li(p("onehalf")), li(p("two")), li(p()), li(p("three")))))
repl("merge_block",
     doc(p("a<a>"), p("b"), p("<b>c")),
     null,
     doc(p("a<a><b>c")))

repl("move_text_down",
     doc(h1("wo<a>ah"), blockquote(p("ah<b>ha"))),
     null,
     doc(h1("wo<a><b>ha")))
repl("move_text_up",
     doc(blockquote(p("foo<a>bar")), p("middle"), h1("quux<b>baz")),
     null,
     doc(blockquote(p("foo<a><b>baz"))))

repl("stitch_deep",
     doc(blockquote(ul(li(p("a")), li(p("b<a>")), li(p("c")), li(p("<b>d")), li(p("e"))))),
     null,
     doc(blockquote(ul(li(p("a")), li(p("b<a><b>d")), li(p("e"))))))
repl("simple",
     doc(p("he<before>llo<a> w<after>orld")),
     doc(p("<a> big<b>")),
     doc(p("he<before>llo big w<after>orld")))
repl("insert_paragraph_open_edges",
     doc(p("one<a>two")),
     doc(p("a<a>"), p("hello"), p("<b>b")),
     doc(p("one"), p("hello"), p("<a>two")))
repl("overwrite_paragraph",
     doc(p("one<a>"), p("t<inside>wo"), p("<b>three<end>")),
     doc(p("a<a>"), p("TWO"), p("<b>b")),
     doc(p("one<a>"), p("TWO"), p("<inside>three<end>")))
repl("stitch",
     doc(p("foo ", em("bar<a>baz"), "<b> quux")),
     doc(p("foo ", em("xy<a>zzy"), " foo<b>")),
     doc(p("foo ", em("barzzy"), " foo quux")))

repl("break",
     doc(p("foo<a>b<inside>b<b>bar")),
     doc(p("<a>", br, "<b>")),
     doc(p("foo", br, "<inside>bar")))
repl("cut_different_block",
     doc(h1("hell<a>o"), p("by<b>e")),
     null,
     doc(h1("helle")))
repl("restore_list",
     doc(h1("hell<a>o"), "<b>"),
     doc(ol(li(p("on<a>e")), li(p("tw<b>o")))),
     doc(h1("helle"), ol(li(p("tw")))))
repl("restore_list_text_after",
     doc(h1("hell<a>o"), p("yo<b>u")),
     doc(ol(li(p("on<a>e")), li(p("tw<b>o")))),
     doc(h1("helle"), ol(li(p("twu")))))
repl("in_empty_block",
     doc(p("a"), p("<a>"), p("b")),
     doc(p("x<a>y<b>z")),
     doc(p("a"), p("y<a>"), p("b")))
repl("dont_shift_everything",
     doc(p("one<a>"), p("two"), p("three")),
     doc(p("outside<a>"), blockquote(p("inside<b>"))),
     doc(p("one"), blockquote(p("inside")), p("two"), p("three")))
repl("close_parent",
     doc(blockquote(p("b<a>c"), p("d<b>e"), p("f"))),
     doc(blockquote(p("x<a>y")), p("after"), "<b>"),
     doc(blockquote(p("b<a>y")), p("after"), blockquote(p("<b>e"), p("f"))))
repl("lopsided",
     doc(blockquote(p("b<a>c"), p("d<b>e"), p("f"))),
     doc(blockquote(p("x<a>y")), p("z<b>")),
     doc(blockquote(p("b<a>y")), p("z<b>e"), blockquote(p("f"))))
repl("deep_insert",
     doc(blockquote(blockquote(p("one"), p("tw<a>o"), p("t<b>hree<3>"), p("four<4>")))),
     doc(ol(li(p("hello<a>world")), li(p("bye"))), p("ne<b>xt")),
     doc(blockquote(blockquote(p("one"), p("tw<a>world")), ol(li(p("bye"))), p("ne<b>hree<3>"), blockquote(p("four<4>")))))
repl("join_inequal",
     doc(h1("hello<a>"), p("<b>you<1>")),
     null,
     doc(h1("hello<a><b>you<1>")))

repl("sticking_out_right",
     doc(p("x"), "<a>"),
     doc("<a>", ul(li(p("a")), li("<b>", p("b")))),
     doc(p("x"), ul(li(p("a")), li(p())), "<a>"))
repl("delete_whole_doc",
     doc("<a>", h1("hi"), p("you"), "<b>"),
     null,
     doc(p()))
repl("cut_empty_node_before",
     doc(blockquote("<a>", p("hi")), p("b<b>x")),
     doc(p("<a>hi<b>")),
     doc(blockquote(p("hix"))))
repl("cut_empty_node_after",
     doc(p("x<a>hi"), blockquote(p("yy"), "<b>"), p("c")),
     doc(p("<a>hi<b>")),
     doc(p("xhi"), blockquote(p()), p("c")))
repl("cut_empty_node_at_start",
     doc(p("<a>x")),
     doc(blockquote(p("hi"), "<a>"), p("b<b>")),
     doc(p(), p("bx")))
repl("cut_empty_node_at_end",
     doc(p("<a>x")),
     doc(p("b<a>"), blockquote("<b>", p("hi"))),
     doc(p(), blockquote(p()), p("x")))

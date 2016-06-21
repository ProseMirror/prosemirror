const {defTest} = require("../tests")
const {tempEditor} = require("./def")
const {cmpNode} = require("../cmp")
const {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, hr} = require("../build")

const commands = require("../../commands")
const listCommands = require("../../commands-list")
const {Schema} = require("../../model")
const {schema, Heading, Doc} = require("../../schema-basic")

const used = Object.create(null)
const n = schema.nodes

function test(cmd, ...args) {
  let known = used[cmd] || 0
  defTest("command_" + cmd + "_" + known, () => {
    let pm = tempEditor({doc: args[args.length - 2]})
    let prep = args.slice(0, args.length - 2)
    let f = commands[cmd] || listCommands[cmd]
    if (prep.length) f = f(...prep)
    f(pm)
    cmpNode(pm.doc, args[args.length - 1])
  })
  used[cmd] = known + 1
}

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
     doc(hr, p("<a>"), hr),
     doc(hr, hr))
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
test("lift",
     doc(ul(li(p("one"), ul(li(p("<a>sub1")), li(p("sub2")))), li(p("two")))),
     doc(ul(li(p("one"), p("<a>sub1"), ul(li(p("sub2")))), li(p("two")))))

test("wrapInList", n.bullet_list,
     doc(p("<a>foo")),
     doc(ul(li(p("foo")))))
test("wrapInList", n.bullet_list,
     doc(blockquote(p("<a>foo"))),
     doc(blockquote(ul(li(p("foo"))))))
test("wrapInList", n.bullet_list,
     doc(p("foo"), p("ba<a>r"), p("ba<b>z")),
     doc(p("foo"), ul(li(p("bar")), li(p("baz")))))
test("wrapInList", n.bullet_list,
     doc(ul(li(p("<a>foo")))),
     doc(ul(li(p("foo")))))
test("wrapInList", n.bullet_list,
     doc(ol(li(p("<a>foo")))),
     doc(ol(li(p("foo")))))
test("wrapInList", n.bullet_list,
     doc(ul(li(p("foo"), p("<a>bar")))),
     doc(ul(li(p("foo"), ul(li(p("bar")))))))
test("wrapInList", n.bullet_list,
     doc(ul(li(p("foo")), li(p("<a>bar")), li(p("baz")))),
     doc(ul(li(p("foo"), ul(li(p("bar")))), li(p("baz")))))

test("wrapInList", n.ordered_list,
     doc(p("<a>foo")),
     doc(ol(li(p("foo")))))
test("wrapInList", n.ordered_list,
     doc(blockquote(p("<a>foo"))),
     doc(blockquote(ol(li(p("foo"))))))
test("wrapInList", n.ordered_list,
     doc(p("foo"), p("ba<a>r"), p("ba<b>z")),
     doc(p("foo"), ol(li(p("bar")), li(p("baz")))))

test("wrapIn", n.blockquote,
     doc(p("fo<a>o")),
     doc(blockquote(p("foo"))))
test("wrapIn", n.blockquote,
     doc(p("fo<a>o"), p("bar"), p("ba<b>z"), p("quux")),
     doc(blockquote(p("foo"), p("bar"), p("baz")), p("quux")))
test("wrapIn", n.blockquote,
     doc(blockquote(p("fo<a>o"))),
     doc(blockquote(blockquote(p("foo")))))
test("wrapIn", n.blockquote,
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
test("splitBlock",
     doc(h1("<a>foo")),
     doc(p(), h1("foo")))

const hSchema = new Schema({
  nodes: schema.nodeSpec.update("heading", {type: Heading, content: "inline<_>*"})
    .update("doc", {type: Doc, content: "heading block*"})
})
function hDoc(a) {
  const hDoc = hSchema.node("doc", null, [
    hSchema.node("heading", {level: 1}, hSchema.text("foobar"))
  ])
  hDoc.tag = {a}
  return hDoc
}

test("splitBlock",
     hDoc(7),
     hSchema.node("doc", null, [
       hSchema.node("heading", {level: 1}, hSchema.text("foobar")),
       hSchema.node("paragraph")
     ]))
test("splitBlock",
     hDoc(4),
     hSchema.node("doc", null, [
       hSchema.node("heading", {level: 1}, hSchema.text("foo")),
       hSchema.node("paragraph", null, hSchema.text("bar"))
     ]))

test("splitListItem", n.list_item,
     doc(p("foo<a>bar")),
     doc(p("foobar")))
test("splitListItem", n.list_item,
     doc("<a>", p("foobar")),
     doc(p("foobar")))
test("splitListItem", n.list_item,
     doc(ul(li(p("foo<a>bar")))),
     doc(ul(li(p("foo")), li(p("bar")))))
test("splitListItem", n.list_item,
     doc(ul(li(p("foo<a>ba<b>r")))),
     doc(ul(li(p("foo")), li(p("r")))))

test("liftListItem", n.list_item,
     doc(ul(li(p("hello"), ul(li(p("o<a><b>ne")), li(p("two")))))),
     doc(ul(li(p("hello")), li(p("one"), ul(li(p("two")))))))
test("liftListItem", n.list_item,
     doc(ul(li(p("hello"), ul(li(p("o<a>ne")), li(p("two<b>")))))),
     doc(ul(li(p("hello")), li(p("one")), li(p("two")))))
test("liftListItem", n.list_item,
     doc(ul(li(p("hello"), ul(li(p("o<a>ne")), li(p("two<b>")), li(p("three")))))),
     doc(ul(li(p("hello")), li(p("one")), li(p("two"), ul(li(p("three")))))))

test("sinkListItem", n.list_item,
     doc(ul(li(p("one")), li(p("t<a><b>wo")), li(p("three")))),
     doc(ul(li(p("one"), ul(li(p("two")))), li(p("three")))))
test("sinkListItem", n.list_item,
     doc(ul(li(p("o<a><b>ne")), li(p("two")), li(p("three")))),
     doc(ul(li(p("one")), li(p("two")), li(p("three")))))
test("sinkListItem", n.list_item,
     doc(ul(li(p("one")), li(p("..."), ul(li(p("two")))), li(p("t<a><b>hree")))),
     doc(ul(li(p("one")), li(p("..."), ul(li(p("two")), li(p("three")))))))

test("liftEmptyBlock",
     doc(blockquote(p("foo"), p("<a>"), p("bar"))),
     doc(blockquote(p("foo")), blockquote(p(), p("bar"))))
test("liftEmptyBlock",
     doc(blockquote(p("foo"), p("<a>"))),
     doc(blockquote(p("foo")), p()))
test("liftEmptyBlock",
     doc(blockquote(p("foo")), blockquote(p("<a>"))),
     doc(blockquote(p("foo")), p("<a>")))
test("liftEmptyBlock",
     doc(ul(li(p("hi")), li(p("<a>")))),
     doc(ul(li(p("hi"))), p()))

test("createParagraphNear",
     doc("<a>", hr),
     doc(p(), hr))
test("createParagraphNear",
     doc(p(), "<a>", hr),
     doc(p(), hr, p()))

test("setBlockType", n.heading, {level: 1},
     doc(p("fo<a>o")),
     doc(h1("foo")))
test("setBlockType", n.heading, {level: 2},
     doc(pre("fo<a>o")),
     doc(h2("foo")))

test("setBlockType", n.paragraph,
     doc(h1("fo<a>o")),
     doc(p("foo")))
test("setBlockType", n.paragraph,
     doc(h1("fo<a>o", em("bar"))),
     doc(p("foo", em("bar"))))
test("setBlockType", n.paragraph,
     doc("<a>", h1("foo")),
     doc(p("foo")))

test("setBlockType", n.code_block,
     doc(h1("fo<a>o")),
     doc(pre("foo")))
test("setBlockType", n.code_block,
     doc(p("fo<a>o", em("bar"))),
     doc(pre("foobar")))

import {Schema, Block, Text, Textblock, EmMark, Slice} from "../model"
import {canSplit, canLift, canWrap, Transform} from "../transform"

import {defTest} from "./tests"
import {cmpNode, is} from "./cmp"

const schema = new Schema({
  nodes: {
    doc: {type: Block, content: "head? block* sect* closing?"},
    head: {type: Textblock, content: "text*"},
    para: {type: Textblock, content: "text[_]*"},
    quote: {type: Block, content: "block+"},
    figure: {type: Block, content: "caption figureimage"},
    figureimage: {type: Block},
    caption: {type: Textblock, content: "text*"},
    sect: {type: Block, content: "head block* sect*"},
    closing: {type: Textblock, content: "text[_]*"},
    text: {type: Text}
  },
  groups: {
    block: ["para", "figure", "quote"]
  },
  marks: {
    em: EmMark
  }
})

function n(name, ...content) { return schema.nodes[name].create(null, content) }
function t(str, em) { return schema.text(str, em ? [schema.mark("em")] : null) }

const doc = n("doc", // 0
              n("head", t("Head")), // 6
              n("para", t("Intro")), // 13
              n("sect", // 14
                n("head", t("Section head")), // 28
                n("sect", // 29
                  n("head", t("Subsection head")), // 46
                  n("para", t("Subtext")), // 55
                  n("figure", // 56
                    n("caption", t("Figure caption")), // 72
                    n("figureimage")), // 74
                  n("quote", n("para", t("!"))))), // 81
              n("sect", // 82
                n("head", t("S2")), // 86
                n("para", t("Yes"))), // 92
              n("closing", t("fin"))) // 97

function split(pos, depth, after) {
  defTest("struct_split_can_" + pos, () => {
    is(canSplit(doc, pos, depth, after && schema.nodes[after]), "canSplit unexpectedly returned false")
  })
}
function noSplit(pos, depth, after) {
  defTest("struct_split_cant_" + pos, () => {
    is(!canSplit(doc, pos, depth, after && schema.nodes[after]), "canSplit unexpectedly returned true")
  })
}

noSplit(0)
noSplit(3)
split(3, 1, "para")
noSplit(6)
split(8)
noSplit(14)
noSplit(17)
split(17, 2)
split(18, 1, "para")
noSplit(46)
split(48)
noSplit(60)
noSplit(62, 2)
noSplit(72)
split(76)
split(77, 2)
noSplit(94)
noSplit(97)

function lift(pos, end) {
  defTest("struct_lift_can_" + pos, () => {
    is(canLift(doc, pos, end), "canLift unexpectedly returned false")
  })
}
function noLift(pos, end) {
  defTest("struct_lift_cant_" + pos, () => {
    is(!canLift(doc, pos, end), "canLift unexpectedly returned true")
  })
}

noLift(0)
noLift(3)
noLift(52)
noLift(70)
lift(76)
noLift(86)

function wrap(pos, end, type) {
  defTest("struct_wrap_can_" + pos, () => {
    is(canWrap(doc, pos, end, schema.nodes[type]), "canWrap unexpectedly returned false")
  })
}
function noWrap(pos, end, type) {
  defTest("struct_wrap_cant_" + pos, () => {
    is(!canWrap(doc, pos, end, schema.nodes[type]), "canWrap unexpectedly returned true")
  })
}

wrap(0, 92, "sect")
noWrap(4, 4, "sect")
wrap(8, 8, "quote")
noWrap(18, 18, "quote")
wrap(55, 74, "quote")
noWrap(90, 90, "figure")
noWrap(95, 95, "quote")

function repl(name, doc, from, to, content, openLeft, openRight, result) {
  defTest("struct_replace_" + name, () => {
    let tr = new Transform(doc).replace(from, to, new Slice(content.content, openLeft, openRight))
    cmpNode(tr.doc, result)
  })
}

repl("insert_heading",
     n("doc", n("sect", n("head", t("foo")), n("para", t("bar")))),
     6, 6, n("doc", n("sect"), n("sect")), 1, 1,
     n("doc", n("sect", n("head", t("foo"))), n("sect", n("head"), n("para", t("bar")))))

repl("impossible",
     n("doc", n("para", t("a")), n("para", t("b"))),
     3, 3, n("doc", n("closing", t("."))), 0, 0,
     n("doc", n("para", t("a")), n("para", t("b"))))

repl("fill_left",
     n("doc", n("sect", n("head", t("foo")), n("para", t("bar")))),
     1, 3, n("doc", n("sect"), n("sect", n("head", t("hi")))), 1, 2,
     n("doc", n("sect", n("head")), n("sect", n("head", t("hioo")), n("para", t("bar")))))

repl("fill_figure_left",
     n("doc"),
     0, 0, n("doc", n("figure", n("figureimage"))), 1, 0,
     n("doc", n("figure", n("caption"), n("figureimage"))))

repl("fill_figure_right",
     n("doc"),
     0, 0, n("doc", n("figure", n("caption"))), 0, 1,
     n("doc", n("figure", n("caption"), n("figureimage"))))

const {Schema, Block, Text, Attribute, Slice} = require("../model")
const {EmMark} = require("../schema-basic")
const {canSplit, liftTarget, findWrapping, Transform} = require("../transform")

const {defTest} = require("./tests")
const {cmpNode, is} = require("./cmp")

const schema = new Schema({
  nodes: {
    doc: {type: Block, content: "head? block* sect* closing?"},
    para: {type: Block, content: "text<_>*", group: "block"},
    head: {type: Block, content: "text*"},
    figure: {type: Block, content: "caption figureimage", group: "block"},
    quote: {type: Block, content: "block+", group: "block"},
    figureimage: {type: Block},
    caption: {type: Block, content: "text*"},
    sect: {type: Block, content: "head block* sect*"},
    closing: {type: Block, content: "text<_>*"},
    tcell: {type: Block, content: "text<_>*"},
    trow: {type: class extends Block {
      get attrs() { return {columns: new Attribute({default: 1})} }
    }, content: "tcell{.columns}"},
    table: {type: class extends Block {
      get attrs() { return {columns: new Attribute({default: 1})} }
    }, content: "trow[columns=.columns]+", group: "block"},
    text: {type: Text},

    fixed: {type: Block, content: "head para closing", group: "block"}
  },
  marks: {
    em: EmMark
  }
})

function n(name, ...content) { return schema.nodes[name].create(null, content) }
function n_(name, attrs, ...content) { return schema.nodes[name].create(attrs, content) }
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
                n("para", t("Yes")), // 91
                n_("table", {columns: 2}, // 92
                   n("trow", n("tcell", t("a")), n("tcell", t("b"))), // 100
                   n("trow", n("tcell", t("c")), n("tcell", t("d"))))), // 110
              n("closing", t("fin"))) // 115

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
noSplit(96)
split(100)
noSplit(107)
noSplit(103)
noSplit(115)

function range(pos, end) {
  return doc.resolve(pos).blockRange(end == null ? undefined : doc.resolve(end))
}

function lift(pos, end) {
  defTest("struct_lift_can_" + pos, () => {
    let r = range(pos, end)
    is((r && liftTarget(r)) != null, "liftTarget unexpectedly returned null")
  })
}
function noLift(pos, end) {
  defTest("struct_lift_cant_" + pos, () => {
    let r = range(pos, end)
    is((r && liftTarget(r)) == null, "liftTarget unexpectedly returned a value")
  })
}

noLift(0)
noLift(3)
noLift(52)
noLift(70)
lift(76)
noLift(86)
noLift(94)

function wrap(pos, end, type) {
  defTest("struct_wrap_can_" + pos, () => {
    let r = range(pos, end), wrapping = r && findWrapping(r, schema.nodes[type])
    is(!!wrapping, "findWrapping unexpectedly returned null")
  })
}
function noWrap(pos, end, type) {
  defTest("struct_wrap_cant_" + pos, () => {
    let r = range(pos, end), wrapping = r && findWrapping(r, schema.nodes[type])
    is(!wrapping, "findWrapping unexpectedly returned a result")
  })
}

wrap(0, 110, "sect")
noWrap(4, 4, "sect")
wrap(8, 8, "quote")
noWrap(18, 18, "quote")
wrap(55, 74, "quote")
noWrap(90, 90, "figure")
wrap(91, 109, "quote")
noWrap(113, 113, "quote")

function repl(name, doc, from, to, content, openLeft, openRight, result) {
  defTest("struct_replace_" + name, () => {
    let slice = content ? new Slice(content.content, openLeft, openRight) : Slice.empty
    let tr = new Transform(doc).replace(from, to, slice)
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

repl("join_figures",
     n("doc", n("figure", n("caption"), n("figureimage")), n("figure", n("caption"), n("figureimage"))),
     3, 8, null, 0, 0,
     n("doc", n("figure", n("caption"), n("figureimage"))))

repl("fill_above_left",
     n("doc", n("sect", n("head"), n("figure", n("caption"), n("figureimage")))),
     7, 9, n("doc", n("para", t("hi"))), 0, 0,
     n("doc", n("sect", n("head"), n("figure", n("caption"), n("figureimage")), n("para", t("hi")))))

function table2(...args) { return n_("table", {columns: 2}, ...args) }
function trow2(...args) { return n_("trow", {columns: 2}, ...args) }

repl("balance_table_delete",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b"))))),
     2, 5, null, 0, 0,
     n("doc", table2(trow2(n("tcell"), n("tcell", t("b"))))))

repl("balance_table_insert_start",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b"))))),
     2, 2, trow2(n("tcell", t("c"))), 0, 0,
     n("doc", n_("table", {columns: 2},
                 trow2(n("tcell", t("c")), n("tcell")),
                 trow2(n("tcell", t("a")), n("tcell", t("b"))))))

repl("balance_table_insert_mid",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b"))))),
     5, 5, trow2(n("tcell", t("c"))), 0, 0,
     n("doc", n_("table", {columns: 2},
                 trow2(n("tcell", t("a")), n("tcell", t("c"))),
                 trow2(n("tcell"), n("tcell", t("b"))))))

repl("balance_table_cut_across",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b"))))),
     4, 6, null, 0, 0,
     n("doc", table2(trow2(n("tcell", t("ab")), n("tcell")))))

repl("join_tables",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b")))),
       table2(trow2(n("tcell", t("c")), n("tcell", t("d"))))),
     9, 15, null, 0, 0,
     n("doc", n_("table", {columns: 2},
                 trow2(n("tcell", t("a")), n("tcell", t("b"))),
                 trow2(n("tcell"), n("tcell", t("d"))))))

repl("join_cells",
     n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b")))),
       table2(trow2(n("tcell", t("c")), n("tcell", t("d"))))),
     7, 16, null, 0, 0,
     n("doc", n_("table", {columns: 2},
                 trow2(n("tcell", t("a")), n("tcell", t("bd"))))))

repl("insert_cell", n("doc", table2(trow2(n("tcell", t("a")), n("tcell", t("b"))))),
     2, 2, trow2(n("tcell", t("c"))), 0, 0,
     n("doc", table2(trow2(n("tcell", t("c")), n("tcell")),
                     trow2(n("tcell", t("a")), n("tcell", t("b"))))))

repl("join_required",
     n("doc", n("fixed", n("head", t("foo")), n("para", t("bar")), n("closing", t("abc")))),
     4, 8, null, 0, 0,
     n("doc", n("fixed", n("head", t("foar")), n("para"), n("closing", t("abc")))))

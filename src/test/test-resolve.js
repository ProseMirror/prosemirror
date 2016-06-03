const {doc, p, em, blockquote} = require("./build")

const {defTest} = require("./tests")
const {cmpNode, cmp} = require("./cmp")

const testDoc = doc(p("ab"), blockquote(p(em("cd"), "ef")))
const _doc = {node: testDoc, start: 0, end: 12}
const _p1 = {node: testDoc.child(0), start: 1, end: 3}
const _blk = {node: testDoc.child(1), start: 5, end: 11}
const _p2 = {node: _blk.node.child(0), start: 6, end: 10}

defTest("resolve", () => {
  let expected = {
    0: [_doc, 0, null, _p1.node],
    1: [_doc, _p1, 0, null, "ab"],
    2: [_doc, _p1, 1, "a", "b"],
    3: [_doc, _p1, 2, "ab", null],
    4: [_doc, 4, _p1.node, _blk.node],
    5: [_doc, _blk, 0, null, _p2.node],
    6: [_doc, _blk, _p2, 0, null, "cd"],
    7: [_doc, _blk, _p2, 1, "c", "d"],
    8: [_doc, _blk, _p2, 2, "cd", "ef"],
    9: [_doc, _blk, _p2, 3, "e", "f"],
    10: [_doc, _blk, _p2, 4, "ef", null],
    11: [_doc, _blk, 6, _p2.node, null],
    12: [_doc, 12, _blk.node, null]
  }

  for (let pos = 0; pos <= testDoc.content.size; pos++) {
    let $pos = testDoc.resolve(pos), exp = expected[pos]
    cmp($pos.depth, exp.length - 4, pos + " depth")
    for (let i = 0; i < exp.length - 3; i++) {
      cmpNode($pos.node(i), exp[i].node, pos + " " + i + " node")
      cmp($pos.start(i), exp[i].start, pos + " " + i + " start")
      cmp($pos.end(i), exp[i].end, pos + " " + i + " end")
      if (i) {
        cmp($pos.before(i), exp[i].start - 1, pos + " " + i + " before")
        cmp($pos.after(i), exp[i].end + 1, pos + " " + i + " end")
      }
    }
    cmp($pos.parentOffset, exp[exp.length - 3], pos + " parentOffset")
    let before = $pos.nodeBefore, eBefore = exp[exp.length - 2]
    cmp(typeof eBefore == "string" ? before.textContent : before, eBefore)
    let after = $pos.nodeAfter, eAfter = exp[exp.length - 1]
    cmp(typeof eAfter == "string" ? after.textContent : after, eAfter)
  }
})

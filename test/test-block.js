import {doc, blockquote, h1, p, li, ol, ul, em, a, br} from "./build"

import Failure from "./failure"
import * as block from "../src/block"

const tests = {}

export default tests

function cmp(a, b, comment) {
  let as = a.toString(), bs = b.toString()
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}

function t(op, name, doc, expect) {
  tests[op + "_" + name] = function() {
    let result = block[op](doc, doc.tag.a)
    cmp(result.doc, expect)
    for (let pos in expect.tag)
      cmp(result.map.map(doc.tag[pos]), expect.tag[pos], pos)
  }
}

t("lift", "simple",
  doc(blockquote(p("one"), p("<a>two"))),
  doc(blockquote(p("one")), p("<a>two")))
t("lift", "noop",
  doc(p("<a>hi")),
  doc(p("<a>hi")))
t("lift", "split",
  doc(blockquote(p("<before>one"), p("<a>two<end>"), p("<after>three"))),
  doc(blockquote(p("<before>one")), p("<a>two<end>"), blockquote(p("<after>three"))))

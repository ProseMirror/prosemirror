import {doc, p, li, ul, em, a} from "./build"

import Failure from "./failure"
import replace from "../src/replace"

const tests = {}

export default tests

function cmp(a, b) {
  let as = a.toString(), bs = b.toString()
  if (as != bs) throw new Failure("expected " + bs + "\n     got " + as)
}

function t(name, base, insert, expect) {
  tests[name] = function() {
    cmp(replace(base, base.tag.a, base.tag.b || base.tag.a,
                insert, insert.tag.a, insert.tag.b),
        expect)
  }
}

t("replace",
  doc(p("hello<a> world")),
  doc(p("<a> big<b>")),
  doc(p("hello big world")))

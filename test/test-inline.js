import {doc, blockquote, h1, p, li, ol, ul, em, strong, a, br} from "./build"

import Failure from "./failure"
import * as inline from "../src/inline"
import tests from "./tests"

import * as style from "../src/style"

function cmp(a, b, comment) {
  let as = a.toString(), bs = b.toString()
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}

function t(op, name, doc, expect, stl) {
  tests[op + "_" + name] = function() {
    let result = inline[op](doc, doc.tag.a, doc.tag.b || doc.tag.a, stl)
    cmp(result, expect)
  }
}

t("addStyle", "bold",
  doc(p("hello <a>there<b>!")),
  doc(p("hello ", strong("there"), "!")),
  style.strong)
t("addStyle", "double_bold",
  doc(p("hello ", strong("<a>there"), "!<b>")),
  doc(p("hello ", strong("there!"))),
  style.strong)

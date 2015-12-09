import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmp, cmpStr, P} from "../cmp"

const test = namespace("draw")

test("update", pm => {
  pm.tr.typeText("bar").apply()
  pm.flush()
  cmpStr(pm.content.textContent, "barfoo")
}, {doc: doc(p("foo"))})

test("minimal_at_end", pm => {
  let oldP = pm.content.querySelector("p")
  pm.tr.typeText("!").apply()
  pm.flush()
  cmp(pm.content.querySelector("p"), oldP)
}, {doc: doc(h1("foo"), p("bar"))})

test("minimal_at_start", pm => {
  let oldP = pm.content.querySelector("p")
  pm.tr.insertText(P(1, 0), "!").apply()
  pm.flush()
  cmp(pm.content.querySelector("p"), oldP)
}, {doc: doc(p("foo"), h1("bar"))})

test("minimal_around", pm => {
  let oldP = pm.content.querySelector("p")
  let oldPre = pm.content.querySelector("pre")
  pm.tr.insertText(P(1, 0), "!").apply()
  pm.flush()
  cmp(pm.content.querySelector("p"), oldP)
  cmp(pm.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_split", pm => {
  let oldP = pm.content.querySelector("p")
  let oldPre = pm.content.querySelector("pre")
  pm.tr.split(P(1, 2)).apply()
  pm.flush()
  cmp(pm.content.querySelector("p"), oldP)
  cmp(pm.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_join", pm => {
  let oldP = pm.content.querySelector("p")
  let oldPre = pm.content.querySelector("pre")
  pm.tr.join(P(2)).apply()
  pm.flush()
  cmp(pm.content.querySelector("p"), oldP)
  cmp(pm.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), h1("x"), pre("baz"))})

import {doc as doc_, withSchema,
        blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "./build"
import {Failure} from "./failure"
import {cmpNode, cmp} from "./cmp"
import {defTest} from "./tests"
import {domFor, domText} from "./test-dom"

import {defaultSchema, Attribute, Schema} from "../src/model"
import {Transform} from "../src/transform"
import {toDOM} from "../src/serialize/dom"
import {fromDOM} from "../src/parse/dom"

let nextID = 0
const idAttribute = new Attribute({
  compute: () => ++nextID,
  mustRecompute: true,
  inheritable: true
})

idAttribute.parseDOM = (dom, options) => options.source != "paste" && dom.getAttribute("block-id") || ++nextID
idAttribute.serializeDOM = (dom, id) => dom.setAttribute("block-id", id)

let attrPred = (_, data) => data.type.prototype.isTextblock
const idSchema = new Schema(defaultSchema.spec.addAttribute(attrPred, "id", idAttribute))

function doc(...args) {
  nextID = 0
  return withSchema(idSchema, () => doc_(...args))
}

function dom(name, doc, expected) {
  defTest("schema_id_dom_" + name, () => {
    nextID = 0
    let derivedDOM = domFor("")
    derivedDOM.documentElement.appendChild(toDOM(doc, {document: derivedDOM}))
    var derivedText = domText(derivedDOM)

    if (derivedText != expected)
      throw new Failure("DOM text mismatch: " + derivedText + " vs " + expected)

    cmpNode(doc, fromDOM(idSchema, derivedDOM.documentElement))
  })
}

dom("simple",
    doc(p("hi"), p("bye")),
    '<p block-id="1">hi</p><p block-id="2">bye</p>')

dom("only_textblock",
    doc(p("hi", br), blockquote(p("bye"))),
    '<p block-id="1">hi<br/></p><blockquote><p block-id="2">bye</p></blockquote>')

function t(name, f) {
  defTest("schema_id_" + name, f)
}

t("stable", () => {
  let d = doc(p("hello<a>"), blockquote(p("<b>bye")))
  let tr = new Transform(d).insertText(d.tag.a, "!").lift(d.tag.b)
  cmpNode(tr.doc, doc(p("hello!"), p("bye")))
  cmp(tr.doc.child(0).attrs.id, 1)
  cmp(tr.doc.child(1).attrs.id, 2)
})

t("split", () => {
  let d = doc(p("hell<a>o"))
  let tr = new Transform(d).split(d.tag.a)
  cmp(tr.doc.child(0).attrs.id, 1)
  cmp(tr.doc.child(1).attrs.id, 2)
})

t("join", () => {
  let d = doc(p("A"), "<a>", p("B"))
  let tr = new Transform(d).join(d.tag.a)
  cmp(tr.doc.child(0).attrs.id, 1)
})

t("setType", () => {
  let d = doc(p("foo"), p("<a>bar<b>"))
  let tr = new Transform(d).setBlockType(d.tag.a, d.tag.b, idSchema.node("heading", {level: 2}))
  cmp(tr.doc.child(1).attrs.id, 2)
})

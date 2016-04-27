import {readInputChange, readCompositionChange} from "../../edit/domchange"

import {namespace} from "./def"
import {doc, p, em, img, strong, blockquote} from "../build"
import {cmpNode} from "../cmp"
import {findTextNode} from "./test-selection"

const test = namespace("domchange", {doc: doc(p("hello"))})

test("add_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heLllo"
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("heLllo")))
})

test("remove_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heo"
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("heo")))
})

test("remove_ambiguous_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "helo"
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("helo")))
})

test("active_marks", pm => {
  pm.execCommand("em:toggle")
  findTextNode(pm.content, "hello").nodeValue = "helloo"
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hello", em("o"))))
})

test("add_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hello!")))
})

test("kill_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.removeChild(txt)
  readInputChange(pm)
  cmpNode(pm.doc, doc(p()))
})

test("add_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hey"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hey"), p("hello")))
})

test("add_duplicate_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hello"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hello"), p("hello")))
})

test("add_repeated_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "helhello"
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("helhello")))
})

test("detect_enter", pm => {
  pm.flush()
  let bq = pm.content.querySelector("blockquote")
  bq.appendChild(document.createElement("p"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(blockquote(p("foo")), blockquote(p())))
}, {doc: doc(blockquote(p("foo"), p("<a>")))})

test("composition_simple", pm => {
  findTextNode(pm.content, "hello").nodeValue = "hellox"
  pm.startOperation()
  readCompositionChange(pm, 0)
  cmpNode(pm.doc, doc(p("hellox")))
})

test("composition_del_inside_markup", pm => {
  pm.flush()
  findTextNode(pm.content, "cd").nodeValue = "c"
  pm.startOperation()
  readCompositionChange(pm, 0)
  cmpNode(pm.doc, doc(p("a", em("b", img, strong("c")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_inside_markup", pm => {
  pm.flush()
  findTextNode(pm.content, "cd").nodeValue = "cdxy"
  pm.startOperation()
  readCompositionChange(pm, 0)
  cmpNode(pm.doc, doc(p("a", em("b", img, strong("cdxy")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_ambiguous", pm => {
  pm.flush()
  pm.execCommand("strong:toggle")
  findTextNode(pm.content, "foo").nodeValue = "fooo"
  pm.startOperation()
  readCompositionChange(pm, 0)
  cmpNode(pm.doc, doc(p("fo", strong("o"), "o")))
}, {doc: doc(p("fo<a>o"))})

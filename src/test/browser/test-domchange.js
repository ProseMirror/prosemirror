import {readInputChange} from "../../edit/domchange"

import {namespace} from "./def"
import {doc, p, em, blockquote} from "../build"
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

test("add_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hello!")))
})

test("add_em_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createElement("em")).appendChild(document.createTextNode("!"))
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("hello", em("!"))))
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
  cmpNode(pm.doc, doc(blockquote(p("foo")), p()))
}, {doc: doc(blockquote(p("foo"), p("<a>")))})

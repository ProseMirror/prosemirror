import {applyDOMChange} from "../../src/edit/domchange"

import {namespace} from "./def"
import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "../build"
import {cmpNode} from "../cmp"
import {findTextNode} from "./test-selection"

const test = namespace("domchange", {doc: doc(p("hello"))})

test("add_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heLllo"
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("heLllo")))
})

test("remove_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heo"
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("heo")))
})

test("add_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("hello!")))
})

test("add_em_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createElement("em")).appendChild(document.createTextNode("!"))
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("hello", em("!"))))
})

test("kill_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.removeChild(txt)
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p()))
})

test("add_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hey"))
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("hey"), p("hello")))
})

test("add_duplicate_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hello"))
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("hello"), p("hello")))
})

test("add_repeated_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "helhello"
  applyDOMChange(pm)
  cmpNode(pm.doc, doc(p("helhello")))
})

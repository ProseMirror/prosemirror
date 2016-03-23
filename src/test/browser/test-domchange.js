import {readDOMChange} from "../../edit/domchange"

import {namespace} from "./def"
import {doc, p, em} from "../build"
import {cmpNode, cmp} from "../cmp"
import {findTextNode} from "./test-selection"

const test = namespace("domchange", {doc: doc(p("hello"))})

function apply(pm) {
  pm.apply(readDOMChange(pm).transform)
}

test("add_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heLllo"
  apply(pm)
  cmpNode(pm.doc, doc(p("heLllo")))
})

test("remove_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "heo"
  apply(pm)
  cmpNode(pm.doc, doc(p("heo")))
})

test("add_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  apply(pm)
  cmpNode(pm.doc, doc(p("hello!")))
})

test("add_em_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.appendChild(document.createElement("em")).appendChild(document.createTextNode("!"))
  apply(pm)
  cmpNode(pm.doc, doc(p("hello", em("!"))))
})

test("kill_node", pm => {
  let txt = findTextNode(pm.content, "hello")
  txt.parentNode.removeChild(txt)
  apply(pm)
  cmpNode(pm.doc, doc(p()))
})

test("add_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hey"))
  apply(pm)
  cmpNode(pm.doc, doc(p("hey"), p("hello")))
})

test("add_duplicate_paragraph", pm => {
  pm.content.insertBefore(document.createElement("p"), pm.content.firstChild)
    .appendChild(document.createTextNode("hello"))
  apply(pm)
  cmpNode(pm.doc, doc(p("hello"), p("hello")))
})

test("add_repeated_text", pm => {
  findTextNode(pm.content, "hello").nodeValue = "helhello"
  apply(pm)
  cmpNode(pm.doc, doc(p("helhello")))
})

test("detect_enter", pm => {
  findTextNode(pm.content, "hello").nodeValue = "hel"
  pm.content.appendChild(document.createElement("p")).innerHTML = "lo"
  let change = readDOMChange(pm)
  cmp(change && change.key, "Enter")
})

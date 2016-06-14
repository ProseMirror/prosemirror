const {readInputChange, readCompositionChange} = require("../../edit/domchange")

const {namespace} = require("./def")
const {doc, p, h1, em, img, strong, blockquote} = require("../build")
const {cmpNode, cmp} = require("../cmp")
const {findTextNode} = require("./test-selection")

function setSel(aNode, aOff, fNode, fOff) {
  let r = document.createRange(), s = window.getSelection()
  r.setEnd(fNode || aNode, fNode ? fOff : aOff)
  r.setStart(aNode, aOff)
  s.removeAllRanges()
  s.addRange(r)
}

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
  pm.addActiveMark(pm.schema.marks.em.create())
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
  cmpNode(pm.doc, doc(blockquote(p("foo")), p()))
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
  pm.addActiveMark(pm.schema.marks.strong.create())
  findTextNode(pm.content, "foo").nodeValue = "fooo"
  pm.startOperation()
  readCompositionChange(pm, 0)
  cmpNode(pm.doc, doc(p("fo", strong("o"), "o")))
}, {doc: doc(p("fo<a>o"))})

test("get_selection", pm => {
  let textNode = findTextNode(pm.content, "abc")
  textNode.nodeValue = "abcd"
  setSel(textNode, 3)
  readInputChange(pm)
  cmpNode(pm.doc, doc(p("abcd")))
  cmp(pm.selection.anchor, 4)
  cmp(pm.selection.head, 4)
}, {doc: doc(p("abc<a>"))})

test("crude_split", pm => {
  pm.flush()
  let para = pm.content.querySelector("p")
  let split = para.parentNode.appendChild(para.cloneNode())
  split.innerHTML = "fg"
  findTextNode(para, "defg").nodeValue = "dexy"
  setSel(split.firstChild, 1)
  readInputChange(pm)
  cmpNode(pm.doc, doc(h1("abc"), p("dexy"), p("fg")))
  cmp(pm.selection.anchor, 13)
}, {doc: doc(h1("abc"), p("defg<a>"))})

test("deep_split", pm => {
  pm.flush()
  let quote = pm.content.querySelector("blockquote")
  let quote2 = pm.content.appendChild(quote.cloneNode(true))
  findTextNode(quote, "abcd").nodeValue = "abx"
  let text2 = findTextNode(quote2, "abcd")
  text2.nodeValue = "cd"
  setSel(text2.parentNode, 0)
  readInputChange(pm)
  cmpNode(pm.doc, doc(blockquote(p("abx")), blockquote(p("cd"))))
  cmp(pm.selection.anchor, 9)
}, {doc: doc(blockquote(p("ab<a>cd")))})

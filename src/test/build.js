const {schema} = require("../schema-basic")
const {Node} = require("../model")

// This file defines a set of helpers for building up documents to be
// used in the test suite. You can say, for example, `doc(p("foo"))`
// to create a document with a paragraph with the text 'foo' in it.
//
// These also support angle-brace notation for marking 'tags'
// (positions) inside of such nodes. If you include `<x>` inside of a
// string, as part of a bigger text node or on its own, the resulting
// node and its parent nodes will have a `tag` property added to them
// that maps this tag name (`x`) to its position inside of that node.

const noTag = Node.prototype.tag = Object.create(null)

function flatten(children, f) {
  let result = [], pos = 0, tag = noTag

  for (let i = 0; i < children.length; i++) {
    let child = children[i]
    if (child.tag && child.tag != Node.prototype.tag) {
      if (tag == noTag) tag = Object.create(null)
      for (let id in child.tag)
        tag[id] = child.tag[id] + (child.flat || child.isText ? 0 : 1) + pos
    }

    if (typeof child == "string") {
      let re = /<(\w+)>/g, m, at = 0, out = ""
      while (m = re.exec(child)) {
        out += child.slice(at, m.index)
        pos += m.index - at
        at = m.index + m[0].length
        if (tag == noTag) tag = Object.create(null)
        tag[m[1]] = pos
      }
      out += child.slice(at)
      pos += child.length - at
      if (out) result.push(f(schema.text(out)))
    } else if (child.flat) {
      for (let j = 0; j < child.flat.length; j++) {
        let node = f(child.flat[j])
        pos += node.nodeSize
        result.push(node)
      }
    } else {
      let node = f(child)
      pos += node.nodeSize
      result.push(node)
    }
  }
  return {nodes: result, tag}
}

function id(x) { return x }

// : (string, ?Object) → (...content: [union<string, Node>]) → Node
// Create a builder function for nodes with content.
function block(type, attrs) {
  return function() {
    let {nodes, tag} = flatten(arguments, id)
    let node = schema.nodes[type].create(attrs, nodes)
    if (tag != noTag) node.tag = tag
    return node
  }
}

// Create a builder function for marks.
function mark(type, attrs) {
  let mark = schema.mark(type, attrs)
  return function() {
    let {nodes, tag} = flatten(arguments, n => mark.type.isInSet(n.marks) ? n : n.mark(mark.addToSet(n.marks)))
    return {flat: nodes, tag}
  }
}

const dataImage = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
exports.dataImage = dataImage

const doc = block("doc")
exports.doc = doc
const p = block("paragraph")
exports.p = p
const blockquote = block("blockquote")
exports.blockquote = blockquote
const pre = block("code_block")
exports.pre = pre
const h1 = block("heading", {level: 1})
exports.h1 = h1
const h2 = block("heading", {level: 2})
exports.h2 = h2
const li = block("list_item")
exports.li = li
const ul = block("bullet_list")
exports.ul = ul
const ol = block("ordered_list")
exports.ol = ol

const br = schema.node("hard_break")
exports.br = br
const img = schema.node("image", {src: dataImage, alt: "x"})
exports.img = img
const img2 = schema.node("image", {src: dataImage, alt: "y"})
exports.img2 = img2
const hr = schema.node("horizontal_rule")
exports.hr = hr

const em = mark("em")
exports.em = em
const strong = mark("strong")
exports.strong = strong
const code = mark("code")
exports.code = code
const a = mark("link", {href: "http://foo"})
exports.a = a
const a2 = mark("link", {href: "http://bar"})
exports.a2 = a2

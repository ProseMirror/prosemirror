import {defaultSchema as schema, Node} from "../model"

// This file defines a set of helpers for building up documents to be
// used in the test suite. You can say, for example, `doc(p("foo"))`
// to create a document with a paragraph with the text 'foo' in it.
//
// These also support angle-brace notation for marking 'tags'
// (positions) inside of such nodes. If you include `<x>` inside of a
// string, as part of a bigger text node or on its own, the resulting
// node and its parent nodes will have a `tag` property added to them
// that maps this tag name (`x`) to its position inside of that node.

let tag = null

function flatten(children, f) {
  tag = null
  let result = [], pos = 0

  for (let i = 0; i < children.length; i++) {
    let child = children[i]
    if (child.tag && child.tag != Node.prototype.tag) {
      if (!tag) tag = Object.create(null)
      for (let id in child.tag) tag[id] = child.tag[id] + (child.flat || child.isText ? 0 : 1) + pos
    }

    if (typeof child == "string") {
      let re = /<(\w+)>/g, m, at = 0, out = ""
      while (m = re.exec(child)) {
        out += child.slice(at, m.index)
        pos += m.index - at
        at = m.index + m[0].length
        if (!tag) tag = Object.create(null)
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
  return result
}

Node.prototype.tag = Object.create(null)

function id(x) { return x }

// : (string, ?Object) → (...content: union<string, Node>) → Node
// Create a builder function for nodes with content.
function block(type, attrs) {
  return function() {
    let node = schema.node(type, attrs, flatten(arguments, id))
    if (tag) node.tag = tag
    return node
  }
}

// : (string, ?Object) → (...content: union<string, Node>) → Node
// Create a builder function for marks.
function mark(type, attrs) {
  let mark = schema.mark(type, attrs)
  return function() {
    let flat = flatten(arguments, n => mark.type.isInSet(n.marks) ? n : n.mark(mark.addToSet(n.marks)))
    return {flat, tag}
  }
}

export const dataImage = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="

export const doc = block("doc")
export const p = block("paragraph")
export const blockquote = block("blockquote")
export const pre = block("code_block")
export const h1 = block("heading", {level: "1"})
export const h2 = block("heading", {level: "2"})
export const li = block("list_item")
export const ul = block("bullet_list")
export const ol = block("ordered_list")

export const br = schema.node("hard_break")
export const img = schema.node("image", {src: dataImage, alt: "x"})
export const img2 = schema.node("image", {src: dataImage, alt: "y"})
export const hr = schema.node("horizontal_rule")

export const em = mark("em")
export const strong = mark("strong")
export const code = mark("code")
export const a = mark("link", {href: "http://foo"})
export const a2 = mark("link", {href: "http://bar"})

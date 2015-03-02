import Node from "../src/node"
import Pos from "../src/pos"
import * as style from "../src/style"

let inlineContext = null

function buildInline(style) {
  return function() {
    return {type: "inline", style: style, content: arguments}
  }
}

function build(type, attrs) {
  return function() {
    return {type: "block", style: type, content: arguments, attrs: attrs}
  }
}

let styles = []

function pushInto(node, values) {
  if (Array.isArray(values))
    for (var i = 0; i < values.length; i++)
      node.push(values[i])
  else
    node.push(values)
}

function parseDoc(value) {
  if (typeof value == "string") {
    let re = /<(\w+)>/g, m, out = "", pos = 0
    let node = new Node.Inline("text", styles.slice(), "")
    while (m = re.exec(value)) {
      node.text += value.slice(pos, m.index)
      pos = m.index + m[0].length
      tags[m[1]] = {node: node, offset: node.text.length}
    }
    node.text += value.slice(pos)
    return node
  } else if (value.type == "inline") {
    let start = styles, result = []
    styles = styles.concat(value.style)
    for (let i = 0; i < value.content.length; i++)
      result = result.concat(parseDoc(value.content[i]))
    styles = start
    return result
  } else if (value.type == "insert") {
    return new Node.Inline(value.style, styles)
  } else {
    let node = new Node(value.style, null, value.attrs)
    styles.length = 0
    for (let i = 0; i < value.content.length; i++)
      pushInto(node, parseDoc(value.content[i]))
    return node
  }
}

let tags = Object.create(null)

function locateTags(doc, tags) {
  let path = [], offset = 0, result = {}
  function scan(node) {
    for (let tag in tags)
      if (tags[tag].node == node)
        result[tag] = new Pos(path.slice(), tags[tag].offset + offset)
    if (node.type.type == "block") offset = 0
    for (let i = 0; i < node.content.length; i++) {
      if (node.type.contains != "inline") path.push(i)
      scan(node.content[i])
      if (node.type.contains != "inline") path.pop()
      else offset += node.content[i].size
    }
  }
  scan(doc)
  return result
}

export function doc() {
  let doc = parseDoc(build("doc").apply(null, arguments))
  doc.tag = locateTags(doc, tags)
  tags = Object.create(null)
  return doc
}

export let p = build("paragraph")
export let h1 = build("heading", {level: 1})
export let li = build("list_item")
export let ul = build("bullet_list")
export let ol = build("ordered_list")
export let em = buildInline(style.em)
export let a = buildInline(style.link("http://foo.com"))
export let br = {type: "insert", style: "hard_break"}

import {Node, Pos, style} from "../src/model"

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
    let node = new Node.Inline("text", styles, "")
    while (m = re.exec(value)) {
      node.text += value.slice(pos, m.index)
      pos = m.index + m[0].length
      tags[m[1]] = {node: node, offset: node.text.length}
    }
    node.text += value.slice(pos)
    return node
  } else if (value.type == "inline") {
    let start = styles, result = []
    styles = style.add(styles, value.style)
    for (let i = 0; i < value.content.length; i++)
      result = result.concat(parseDoc(value.content[i]))
    styles = start
    return result
  } else if (value.type == "insert") {
    let type = Node.types[value.style]
    if (type.type == "inline")
      return new Node.Inline(type, styles, value.text, value.attrs)
    else
      return new Node(type, value.content, value.attrs)
  } else {
    let node = new Node(value.style, null, value.attrs)
    styles = []
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
      let child = node.content[i]
      if (node.type.contains != "inline") path.push(i)
      scan(child)
      if (node.type.contains != "inline") path.pop()
      else offset += child.size
      if (child.type == Node.types.text && child.text == "")
        node.content.splice(i--, 1)
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
export let blockquote = build("blockquote")
export let pre = build("code_block")
export let pre2 = build("code_block", {params: ""})
export let h1 = build("heading", {level: 1})
export let h2 = build("heading", {level: 2})
export let li = build("list_item")
export let ul = build("bullet_list", {bullet: "*", tight: true})
export let uldash = build("bullet_list", {bullet: "-", tight: true})
export let ol = build("ordered_list", {order: 1, tight: true})
export let em = buildInline(style.em)
export let strong = buildInline(style.strong)
export let code = buildInline(style.code)
export let a = buildInline(style.link("http://foo"))
export let a2 = buildInline(style.link("http://bar"))
export let br = {type: "insert", style: "hard_break"}
export let img = {type: "insert", style: "image", attrs: {src: "x.png", alt: "x"}}
export let hr = {type: "insert", style: "horizontal_rule"}
export let hr2 = {type: "insert", style: "horizontal_rule", attrs: {markup: "---"}}

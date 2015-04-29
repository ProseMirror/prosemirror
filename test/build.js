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

function parseDoc(value, target, path) {
  if (typeof value == "string") {
    let offset = target.maxOffset
    let re = /<(\w+)>/g, m, pos = 0, out = ""
    while (m = re.exec(value)) {
      out += value.slice(pos, m.index)
      pos = m.index + m[0].length
      tags[m[1]] = new Pos(path, offset + out.length)
    }
    out += value.slice(pos)
    if (out) target.push(Node.text(out, styles))
  } else if (value.type == "inline") {
    let start = styles, result = []
    styles = style.add(styles, value.style)
    for (let i = 0; i < value.content.length; i++)
      parseDoc(value.content[i], target, path)
    styles = start
  } else if (value.type == "insert") {
    let type = Node.types[value.style]
    if (type.type == "inline")
      target.push(new Node.Inline(type, value.attrs, styles, value.text))
    else
      target.push(new Node(type, value.attrs, value.content))
  } else {
    let node = new Node(value.style, value.attrs)
    let nodePath = path.concat(target.maxOffset)
    styles = []
    for (let i = 0; i < value.content.length; i++)
      parseDoc(value.content[i], node, nodePath)
    target.push(node)
  }
}

let tags = Object.create(null)

export function doc() {
  let doc = new Node("doc")
  for (let i = 0; i < arguments.length; i++)
    parseDoc(arguments[i], doc, [])
  doc.tag = tags
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

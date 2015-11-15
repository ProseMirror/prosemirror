import {defaultSchema as schema, Pos} from "../src/model"

let inlineContext = null

function buildInline(style) {
  return function() {
    return {type: "span", style: style, content: arguments}
  }
}

function build(type, attrs) {
  return function() {
    return {type: "block", style: type, content: arguments, attrs: attrs}
  }
}

let styles = []

function countOffset(nodes) {
  return nodes.reduce((s, n) => s + (n.text == null ? 1 : n.text.length), 0)
}

function parseDoc(value, content, path) {
  if (typeof value == "string") {
    let re = /<(\w+)>/g, m, pos = 0, out = ""
    let offset = countOffset(content)
    while (m = re.exec(value)) {
      out += value.slice(pos, m.index)
      pos = m.index + m[0].length
      tags[m[1]] = new Pos(path, offset + out.length)
    }
    out += value.slice(pos)
    if (out) content.push(schema.text(out, styles))
  } else if (value.type == "span") {
    let start = styles, result = []
    styles = value.style.addToSet(styles)
    for (let i = 0; i < value.content.length; i++)
      parseDoc(value.content[i], content, path)
    styles = start
  } else if (value.type == "insert") {
    let type = schema.nodeType(value.style)
    if (type.type == "span")
      content.push(schema.node(type, value.attrs, value.text, styles))
    else
      content.push(schema.node(type, value.attrs, value.content))
  } else {
    let inner = []
    let nodePath = path.concat(content.length)
    styles = []
    for (let i = 0; i < value.content.length; i++)
      parseDoc(value.content[i], inner, nodePath)
    content.push(schema.node(value.style, value.attrs, inner))
  }
}

let tags = Object.create(null)

export function doc() {
  let content = []
  for (let i = 0; i < arguments.length; i++)
    parseDoc(arguments[i], content, [])
  let doc = schema.node("doc", null, content)
  doc.tag = tags
  tags = Object.create(null)
  return doc
}

export let p = build("paragraph")
export let blockquote = build("blockquote")
export let pre = build("code_block")
export let pre2 = build("code_block", {params: ""})
export let h1 = build("heading", {level: "1"})
export let h2 = build("heading", {level: "2"})
export let li = build("list_item")
export let ul = build("bullet_list")
export let ol = build("ordered_list", {order: "1"})
export let em = buildInline(schema.style("em"))
export let strong = buildInline(schema.style("strong"))
export let code = buildInline(schema.style("code"))
export let a = buildInline(schema.style("link", {href: "http://foo"}))
export let a2 = buildInline(schema.style("link", {href: "http://bar"}))
export let br = {type: "insert", style: "hard_break"}
export const dataImage = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
export let img = {type: "insert", style: "image", attrs: {src: dataImage, alt: "x"}}
export let hr = {type: "insert", style: "horizontal_rule"}

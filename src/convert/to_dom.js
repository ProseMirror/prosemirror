import {style} from "../model"
import {defineTarget} from "./convert"

// FIXME un-export, define proper extension mechanism
export const render = Object.create(null), renderStyle = Object.create(null)

let doc = null

export function toDOM(node, options) {
  doc = options.document
  return renderNodes(node.content, options)
}

defineTarget("dom", toDOM)

export function toHTML(node, options) {
  let wrap = options.document.createElement("div")
  wrap.appendChild(toDOM(node, options))
  return wrap.innerHTML
}

defineTarget("html", toHTML)

export function renderNodeToDOM(node, options, offset) {
  let dom = renderNode(node, options, offset)
  if (options.renderInlineFlat && node.type.type == "span") {
    dom = wrapInlineFlat(node, dom)
    dom = options.renderInlineFlat(node, dom, offset) || dom
  }
  return dom
}

function elt(name, ...children) {
  let dom = doc.createElement(name)
  for (let i = 0; i < children.length; i++) {
    let child = children[i]
    dom.appendChild(typeof child == "string" ? doc.createTextNode(child) : child)
  }
  return dom
}

function wrap(node, options, type) {
  let dom = elt(type || node.type.name)
  if (node.type.contains != "span")
    renderNodesInto(node.content, dom, options)
  else if (options.renderInlineFlat)
    renderInlineContentFlat(node.content, dom, options)
  else
    renderInlineContent(node.content, dom, options)
  return dom
}

function wrapIn(type) {
  return function(node, options) { return wrap(node, options, type) }
}

function renderNodes(nodes, options) {
  let frag = doc.createDocumentFragment()
  renderNodesInto(nodes, frag, options)
  return frag
}

function renderNode(node, options, offset) {
  let dom = render[node.type.name](node, options)
  if (options.onRender)
    dom = options.onRender(node, dom, offset) || dom
  return dom
}

function renderNodesInto(nodes, where, options) {
  for (let i = 0; i < nodes.length; i++) {
    if (options.path) options.path.push(i)
    where.appendChild(renderNode(nodes[i], options, i))
    if (options.path) options.path.pop()
  }
}

function renderInlineContent(nodes, where, options) {
  let top = where
  let active = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i], styles = node.styles
    let keep = 0
    for (; keep < Math.min(active.length, styles.length); ++keep)
      if (!style.same(active[keep], styles[keep])) break
    while (keep < active.length) {
      active.pop()
      top = top.parentNode
    }
    while (active.length < styles.length) {
      let add = styles[active.length]
      active.push(add)
      top = top.appendChild(renderStyle[add.type](add))
    }
    top.appendChild(renderNode(node, options, i))
  }
}

function wrapInlineFlat(node, dom) {
  let styles = node.styles
  for (let i = styles.length - 1; i >= 0; i--) {
    let wrap = renderStyle[styles[i].type](styles[i])
    wrap.appendChild(dom)
    dom = wrap
  }
  return dom
}

function renderInlineContentFlat(nodes, where, options) {
  let offset = 0
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    let dom = wrapInlineFlat(node, renderNode(node, options, i))
    dom = options.renderInlineFlat(node, dom, offset) || dom
    where.appendChild(dom)
    offset += node.size
  }
  if (!nodes.length || nodes[nodes.length - 1].type.name == "hard_break")
    where.appendChild(elt("br")).setAttribute("pm-force-br", "true")
}

// Block nodes

render.blockquote = wrap

render.code_block = (node, options) => {
  let code = wrap(node, options, "code")
  if (node.attrs.params != null)
    code.className = "fence " + node.attrs.params.replace(/(^|\s+)/g, "$&lang-")
  return elt("pre", code)
}

render.heading = (node, options) => wrap(node, options, "h" + node.attrs.level)

render.horizontal_rule = _node => elt("hr")

render.bullet_list = (node, options) => {
  let dom = wrap(node, options, "ul")
  let bul = node.attrs.bullet
  dom.setAttribute("class", bul == "+" ? "bullet_plus" : bul == "-" ? "bullet_dash" : "bullet_star")
  if (node.attrs.tight) dom.setAttribute("class", "tight")
  return dom
}

render.ordered_list = (node, options) => {
  let dom = wrap(node, options, "ol")
  if (node.attrs.order > 1) dom.setAttribute("start", node.attrs.order)
  if (node.attrs.tight) dom.setAttribute("class", "tight")
  return dom
}

render.list_item = wrapIn("li")

render.paragraph = wrapIn("p")

render.html_block = node => {
  let dom = elt("div")
  dom.innerHTML = node.attrs.html
  dom.setAttribute("pm-html", "html_block")
  return dom
}

// Inline content

render.text = node => doc.createTextNode(node.text)

render.image = node => {
  let dom = elt("img")
  dom.setAttribute("src", node.attrs.src)
  if (node.attrs.title) dom.setAttribute("title", node.attrs.title)
  if (node.attrs.alt) dom.setAttribute("alt", node.attrs.alt)
  return dom
}

render.hard_break = _node => elt("br")

render.html_tag = node => {
  let dom = elt("span")
  dom.innerHTML = node.attrs.html
  dom.setAttribute("pm-html", "html_tag")
  return dom
}

// Inline styles

renderStyle.em = () => elt("em")

renderStyle.strong = () => elt("strong")

renderStyle.code = () => elt("code")

renderStyle.link = style => {
  let dom = elt("a")
  dom.setAttribute("href", style.href)
  if (style.title) dom.setAttribute("title", style.title)
  return dom
}

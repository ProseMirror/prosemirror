import * as style from "./style"

const render = Object.create(null), renderStyle = Object.create(null)

let doc = null

export default function toDOM(node, options) {
  doc = options.document
  return renderNodes(node.content, options)
}

toDOM.renderNode = renderNode

function elt(name) {
  let dom = doc.createElement(name)
  for (let i = 1; i < arguments.length; i++) {
    let arg = arguments[i]
    dom.appendChild(typeof arg == "string" ? doc.createTextNode(arg) : arg)
  }
  return dom
}

function wrap(node, options, type) {
  let dom = elt(type || node.type.name)
  if (node.type.contains == "inline")
    renderInlineContent(node.content, dom, options)
  else
    renderNodesInto(node.content, dom, options)
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
  for (let i = 0; i < nodes.length; i++)
    where.appendChild(renderNode(nodes[i], options, i))
}

function renderInlineContent(nodes, where, options) {
  let top = where
  let active = []
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i], styles = node.styles
    for (var keep = 0; keep < Math.min(active.length, styles.length); ++keep)
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

// Block nodes

render.blockquote = wrap

render.code_block = node => {
  let code = elt("code", node.textContent)
  if (node.attrs.params) {
    code.className = node.attrs.params.replace(/(^|\s+)/g, "$&lang-")
    code.setAttribute("mm-params", node.attrs.params)
  }
  return elt("pre", code)
}

render.heading = (node, options) => wrap(node, options, "h" + node.attrs.level)

render.horizontal_rule = node => {
  let dom = elt("hr")
  dom.setAttribute("mm-markup", node.attrs.markup)
  return dom
}

render.bullet_list = (node, options) => {
  let dom = wrap(node, options, "ul")
  dom.setAttribute("mm-bullet", node.attrs.bullet)
  if (node.attrs.tight) dom.setAttribute("mm-tight", "true")
  return dom
}

render.ordered_list = (node, options) => {
  let dom = wrap(node, options, "ol")
  if (node.attrs.order > 1) dom.setAttribute("start", node.attrs.order)
  if (node.attrs.tight) dom.setAttribute("mm-tight", "true")
  return dom
}

render.list_item = wrapIn("li")

render.paragraph = wrapIn("p")

render.html_block = node => {
  let dom = elt("div")
  dom.innerHTML = node.attrs.html
  dom.setAttribute("mm-html", "html_block")
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

render.hard_break = node => elt("br")

render.html_tag = node => {
  let dom = elt("span")
  dom.innerHTML = node.attrs.html
  dom.setAttribute("mm-html", "html_tag")
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

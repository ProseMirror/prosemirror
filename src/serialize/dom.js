import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle, Pos} from "../model"
import {defineTarget} from "./index"
import {elt} from "../dom"

let doc = null

// declare_global: window

export function toDOM(node, options = {}) {
  doc = options.document || window.document
  return renderNodes(node.children, options)
}

defineTarget("dom", toDOM)

export function toHTML(node, options) {
  let wrap = (options && options.document || window.document).createElement("div")
  wrap.appendChild(toDOM(node, options))
  return wrap.innerHTML
}

defineTarget("html", toHTML)

export function renderNodeToDOM(node, options, offset) {
  let dom = renderNode(node, options, offset)
  if (options.renderInlineFlat && node.isInline) {
    dom = wrapInlineFlat(node, dom, options)
    dom = options.renderInlineFlat(node, dom, offset) || dom
  }
  return dom
}

function wrap(node, options, type) {
  let dom = elt(type || node.type.name)
  if (!node.isTextblock)
    renderNodesInto(node.children, dom, options)
  else if (options.renderInlineFlat)
    renderInlineContentFlat(node.children, dom, options)
  else
    renderInlineContent(node.children, dom, options)
  return dom
}

function wrapIn(type) {
  return (node, options) => wrap(node, options, type)
}

function renderNodes(nodes, options) {
  let frag = doc.createDocumentFragment()
  renderNodesInto(nodes, frag, options)
  return frag
}

function renderNode(node, options, offset) {
  let dom = node.type.serializeDOM(node, options)
  for (let attr in node.type.attrs) {
    let desc = node.type.attrs[attr]
    if (desc.serializeDOM) desc.serializeDOM(dom, node.attrs[attr], options, node)
  }
  if (options.onRender && node.isBlock)
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
      if (!styles[keep].eq(active[keep])) break
    while (keep < active.length) {
      active.pop()
      top = top.parentNode
    }
    while (active.length < styles.length) {
      let add = styles[active.length]
      active.push(add)
      top = top.appendChild(renderStyle(add, options))
    }
    top.appendChild(renderNode(node, options, i))
  }
}

function renderStyle(marker, options) {
  let dom = marker.type.serializeDOM(marker, options)
  for (let attr in marker.type.attrs) {
    let desc = marker.type.attrs[attr]
    if (desc.serializeDOM) desc.serializeDOM(dom, marker.attrs[attr], options)
  }
  return dom
}

function wrapInlineFlat(node, dom, options) {
  let styles = node.styles
  for (let i = styles.length - 1; i >= 0; i--) {
    let wrap = renderStyle(styles[i], options)
    wrap.appendChild(dom)
    dom = wrap
  }
  return dom
}

function renderInlineContentFlat(nodes, where, options) {
  let offset = 0
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    let dom = wrapInlineFlat(node, renderNode(node, options, i), options)
    dom = options.renderInlineFlat(node, dom, offset) || dom
    where.appendChild(dom)
    offset += node.offset
  }

  if (!nodes.length || nodes[nodes.length - 1].type.name == "hard_break")
    where.appendChild(elt("br")).setAttribute("pm-force-br", "true")
  else if (where.lastChild.contentEditable == "false")
    where.appendChild(doc.createTextNode(""))
}

// Block nodes

function def(cls, method) { cls.prototype.serializeDOM = method }

def(BlockQuote, wrapIn("blockquote"))

BlockQuote.prototype.clicked = (_, path, dom, coords) => {
  let childBox = dom.firstChild.getBoundingClientRect()
  if (coords.left < childBox.left - 2) return Pos.from(path)
}

def(BulletList, wrapIn("ul"))

def(OrderedList, (node, options) => {
  let dom = wrap(node, options, "ol")
  if (node.attrs.order > 1) dom.setAttribute("start", node.attrs.order)
  return dom
})

OrderedList.prototype.clicked = BulletList.prototype.clicked = (_, path, dom, coords) => {
  for (let i = 0; i < dom.childNodes.length; i++) {
    let child = dom.childNodes[i]
    if (!child.hasAttribute("pm-path")) continue
    let childBox = child.getBoundingClientRect()
    if (coords.left > childBox.left - 2) return null
    if (childBox.top <= coords.top && childBox.bottom >= coords.top)
      return new Pos(path, i)
  }
}

def(ListItem, wrapIn("li"))

def(HorizontalRule, () => elt("hr"))

def(Paragraph, wrapIn("p"))

def(Heading, (node, options) => wrap(node, options, "h" + node.attrs.level))

def(CodeBlock, (node, options) => {
  let code = wrap(node, options, "code")
  if (node.attrs.params != null)
    code.className = "fence " + node.attrs.params.replace(/(^|\s+)/g, "$&lang-")
  return elt("pre", code)
})

// Inline content

def(Text, node => doc.createTextNode(node.text))

def(Image, node => {
  return elt("img", {
    src: node.attrs.src,
    alt: node.attrs.alt,
    title: node.attrs.title,
    contentEditable: false
  })
})

def(HardBreak, () => elt("br"))

// Inline styles

def(EmStyle, () => elt("em"))

def(StrongStyle, () => elt("strong"))

def(CodeStyle, () => elt("code"))

def(LinkStyle, style => {
  let dom = elt("a")
  dom.setAttribute("href", style.attrs.href)
  if (style.attrs.title) dom.setAttribute("title", style.attrs.title)
  return dom
})

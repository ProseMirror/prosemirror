import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle, Pos} from "../model"
import {defineTarget} from "./index"

// declare_global: window

class DOMSerializer {
  constructor(options) {
    this.options = options || {}
    this.doc = this.options.document || window.document
  }

  elt(tag, attrs, ...args) {
    let result = this.doc.createElement(tag)
    if (attrs) for (let name in attrs) {
      if (name == "style")
        result.style.cssText = attrs[name]
      else if (attrs[name])
        result.setAttribute(name, attrs[name])
    }
    for (let i = 0; i < args.length; i++)
      result.appendChild(typeof args[i] == "string" ? doc.createTextNode(args[i]) : args[i])
    return result
  }

  renderNode(node, offset) {
    let dom = node.type.serializeDOM(node, this)
    for (let attr in node.type.attrs) {
      let desc = node.type.attrs[attr]
      if (desc.serializeDOM) desc.serializeDOM(dom, node.attrs[attr], this, node)
    }
    if (options.onRender && node.isBlock)
      dom = options.onRender(node, dom, offset) || dom
    return dom
  }

  renderContent(node, where) {
    if (!where) where = this.doc.createDocumentFragment()
    if (!node.isTextblock)
      this.renderBlocksInto(node, where)
    else if (options.renderInlineFlat)
      this.renderInlineFlatInto(node, where)
    else
      this.renderIndlineInto(node, where)
    return where
  }

  renderBlocksInto(parent, where) {
    for (let i = 0; i < parent.size; i++) {
      if (this.options.path) this.options.path.push(i)
      where.appendChild(this.renderNode(parent.get(i), i))
      if (this.options.path) this.options.path.pop()
    }
  }

  renderInlineInto(parent, where) {
    let top = where
    let active = []
    parent.chunks((node, text, marks, start) => {
      let keep = 0
      for (; keep < Math.min(active.length, marks.length); ++keep)
        if (!marks[keep].eq(active[keep])) break
      while (keep < active.length) {
        active.pop()
        top = top.parentNode
      }
      while (active.length < marks.length) {
        let add = mark[active.length]
        active.push(add)
        top = top.appendChild(this.renderMark(add))
      }
      top.appendChild(node ? this.renderNode(node, start) : this.doc.createTextNode(text))
    })
  }

  renderInlineFlatInto(parent, where) {
    parent.chunks((node, text, marks, start) => {
      let dom = node ? this.renderNode(node, start) : this.doc.createTextNode(text)
      dom = this.wrapInlineFlat(dom, marks)
      dom = options.renderInlineFlat(node || text, dom, offset) || dom
      where.appendChild(dom)
    })
    if (!parent.type.isCode && (!parent.length || where.lastChild.nodeName == "BR"))
      where.appendChild(this.elt("br")).setAttribute("pm-force-br", "true")
    else if (where.lastChild.contentEditable == "false")
      where.appendChild(this.doc.createTextNode(""))
  }

  renderMark(mark) {
    let dom = mark.type.serializeDOM(mark, this)
    for (let attr in marker.type.attrs) {
      let desc = marker.type.attrs[attr]
      if (desc.serializeDOM) desc.serializeDOM(dom, mark.attrs[attr], this)
    }
    return dom
  }

  wrapInlineFlat(dom, marks) {
    for (let i = marks.length - 1; i >= 0; i--) {
      let wrap = this.renderMark(marks[i])
      wrap.appendChild(dom)
      dom = wrap
    }
    return dom
  }

  renderAs(node, tagName, tagAttrs) {
    return this.renderContent(node, this.elt(tagName, tagAttrs))
  }
}

export function toDOM(node, options = {}) {
  return new DOMSerializer(options).renderContent(node)
}

defineTarget("dom", toDOM)

export function toHTML(node, options) {
  let serializer = new DOMSerializer(options)
  let wrap = serializer.elt("div")
  wrap.appendChild(serializer.renderContent(node))
  return wrap.innerHTML
}

defineTarget("html", toHTML)

export function renderTextToDOM(text, marks, options, offset) {
  let serializer = new DOMSerializer(options)
  let dom = serializer.wrapInlineFlat(serializer.dom.createTextNode(text), marks)
  if (options.wrapInlineFlat) dom = options.wrapInlineFlat(text, dom, offset)
  return dom
}

export function renderNodeToDOM(node, options, offset) {
  let serializer = new DOMSerializer(options)
  let dom = serializer.renderNode(node, offset)
  if (node.isInline) {
    dom = serializer.wrapInlineFlat(dom, node.marks)
    if (serializer.options.renderInlineFlat)
      dom = optfions.renderInlineFlat(node, dom, offset) || dom
  }
  return dom
}

// Block nodes

function def(cls, method) { cls.prototype.serializeDOM = method }

def(BlockQuote, (node, s) => s.renderAs(node, "blockquote"))

BlockQuote.prototype.clicked = (_, path, dom, coords) => {
  let childBox = dom.firstChild.getBoundingClientRect()
  if (coords.left < childBox.left - 2) return Pos.from(path)
}

def(BulletList, (node, s) => s.renderAs(node, "ul"))

def(OrderedList, (node, s) => s.renderAs(node, "ol", {start: node.attrs.order}))

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

def(ListItem, (node, s) => s.renderAs(node, "li"))

def(HorizontalRule, (_, s) => s.elt("hr"))

def(Paragraph, (node, s) => s.renderAs(node, "p"))

def(Heading, (node, s) => s.renderAs(node, "h" + node.attrs.level))

def(CodeBlock, (node, s) => {
  let code = s.renderAs(node, "code")
  if (node.attrs.params != null)
    code.className = "fence " + node.attrs.params.replace(/(^|\s+)/g, "$&lang-")
  return s.elt("pre", null, code)
})

// Inline content

def(Image, (node, s) => s.elt("img", {
  src: node.attrs.src,
  alt: node.attrs.alt,
  title: node.attrs.title,
  contentEditable: false
}))

def(HardBreak, (_, s) => s.elt("br"))

// Inline styles

def(EmStyle, (_, s) => s.elt("em"))

def(StrongStyle, (_, s) => s.elt("strong"))

def(CodeStyle, (_, s) => s.elt("code"))

def(LinkStyle, (mark, s) => s.elt("a", {href: mark.attrs.href,
                                        title: mark.attrs.title}))

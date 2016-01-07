import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark, Pos} from "../model"

import {defineTarget} from "./register"

// ;; Object used to to expose relevant values and methods
// to DOM serializer functions.
class DOMSerializer {
  constructor(options) {
    // :: Object The options passed to the serializer.
    this.options = options || {}
    // :: DOMDocument The DOM document in which we are working.
    this.doc = this.options.document || window.document
  }

  // :: (string, ?Object, ...union<string, DOMNode>) → DOMNode
  // Create a DOM node of the given type, with (optionally) the given
  // attributes and content. Content elements may be strings (for text
  // nodes) or other DOM nodes.
  elt(type, attrs, ...content) {
    let result = this.doc.createElement(type)
    if (attrs) for (let name in attrs) {
      if (name == "style")
        result.style.cssText = attrs[name]
      else if (attrs[name])
        result.setAttribute(name, attrs[name])
    }
    for (let i = 0; i < content.length; i++)
      result.appendChild(typeof content[i] == "string" ? this.doc.createTextNode(content[i]) : content[i])
    return result
  }

  renderNode(node, offset) {
    let dom = node.type.serializeDOM(node, this)
    if (this.options.onRender)
      dom = this.options.onRender(node, dom, offset) || dom
    return dom
  }

  renderContent(node, where) {
    if (!where) where = this.doc.createDocumentFragment()
    if (!node.isTextblock)
      this.renderBlocksInto(node, where)
    else if (this.options.renderInlineFlat)
      this.renderInlineFlatInto(node, where)
    else
      this.renderInlineInto(node, where)
    return where
  }

  renderBlocksInto(parent, where) {
    for (let i = parent.iter(), child; child = i.next().value;) {
      if (this.options.path) this.options.path.push(i.offset - child.width)
      where.appendChild(this.renderNode(child, i.offset - child.width))
      if (this.options.path) this.options.path.pop()
    }
  }

  renderInlineInto(parent, where) {
    let top = where
    let active = []
    parent.forEach((node, offset) => {
      let keep = 0
      for (; keep < Math.min(active.length, node.marks.length); ++keep)
        if (!node.marks[keep].eq(active[keep])) break
      while (keep < active.length) {
        active.pop()
        top = top.parentNode
      }
      while (active.length < node.marks.length) {
        let add = node.marks[active.length]
        active.push(add)
        top = top.appendChild(this.renderMark(add))
      }
      top.appendChild(this.renderNode(node, offset))
    })
  }

  renderInlineFlatInto(parent, where) {
    parent.forEach((node, start) => {
      let dom = this.renderNode(node, start)
      dom = this.wrapInlineFlat(dom, node.marks)
      dom = this.options.renderInlineFlat(node, dom, start) || dom
      where.appendChild(dom)
    })
  }

  renderMark(mark) {
    return mark.type.serializeDOM(mark, this)
  }

  wrapInlineFlat(dom, marks) {
    for (let i = marks.length - 1; i >= 0; i--) {
      let wrap = this.renderMark(marks[i])
      wrap.appendChild(dom)
      dom = wrap
    }
    return dom
  }

  // :: (Node, string, ?Object) → DOMNode
  // Render the content of ProseMirror node into a DOM node with the
  // given tag name and attributes.
  renderAs(node, tagName, tagAttrs) {
    return this.renderContent(node, this.elt(tagName, tagAttrs))
  }
}

// :: (Node, ?Object) → DOMFragment
// Serialize the content of the given node to a DOM fragment. When not
// in the browser, the `document` option, containing a DOM document,
// should be passed so that the serialize can create nodes.
//
// To define rendering behavior for your own [node](#NodeType) and
// [mark](#MarkType) types, give them a `serializeDOM` method. This
// method is passed a `Node` and a `DOMSerializer`, and should return
// the [DOM
// node](https://developer.mozilla.org/en-US/docs/Web/API/Node) that
// represents this node and its content. For marks, that should be an
// inline wrapping node like `<a>` or `<strong>`.
//
// Individual attributes can also define serialization behavior. If an
// `Attribute` object has a `serializeDOM` method, that will be called
// with the DOM node representing the node that the attribute applies
// to and the atttribute's value, so that it can set additional DOM
// attributes on the DOM node.
export function toDOM(node, options) {
  return new DOMSerializer(options).renderContent(node)
}

defineTarget("dom", toDOM)

// :: (Node, ?Object) → DOMNode
// Serialize a given node to a DOM node. This is useful when you need
// to serialize a part of a document, as opposed to the whole
// document.
export function nodeToDOM(node, options, offset) {
  let serializer = new DOMSerializer(options)
  let dom = serializer.renderNode(node, offset)
  if (node.isInline) {
    dom = serializer.wrapInlineFlat(dom, node.marks)
    if (serializer.options.renderInlineFlat)
      dom = options.renderInlineFlat(node, dom, offset) || dom
  }
  return dom
}

// :: (Node, ?Object) → string
// Serialize a node as an HTML string. Goes through `toDOM` and then
// serializes the result. Again, you must pass a `document` option
// when not in the browser.
export function toHTML(node, options) {
  let serializer = new DOMSerializer(options)
  let wrap = serializer.elt("div")
  wrap.appendChild(serializer.renderContent(node))
  return wrap.innerHTML
}

defineTarget("html", toHTML)

// Block nodes

function def(cls, method) { cls.prototype.serializeDOM = method }

def(BlockQuote, (node, s) => s.renderAs(node, "blockquote"))

BlockQuote.prototype.countCoordsAsChild = (_, path, dom, coords) => {
  let childBox = dom.firstChild.getBoundingClientRect()
  if (coords.left < childBox.left - 2) return Pos.from(path)
}

def(BulletList, (node, s) => s.renderAs(node, "ul"))

def(OrderedList, (node, s) => s.renderAs(node, "ol", {start: node.attrs.order != "1" && node.attrs.order}))

OrderedList.prototype.countCoordsAsChild = BulletList.prototype.countCoordsAsChild = (_, path, dom, coords) => {
  for (let i = 0; i < dom.childNodes.length; i++) {
    let child = dom.childNodes[i]
    if (!child.hasAttribute("pm-offset")) continue
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

def(Text, (node, s) => s.doc.createTextNode(node.text))

def(Image, (node, s) => s.elt("img", {
  src: node.attrs.src,
  alt: node.attrs.alt,
  title: node.attrs.title
}))

def(HardBreak, (_, s) => s.elt("br"))

// Inline styles

def(EmMark, (_, s) => s.elt("em"))

def(StrongMark, (_, s) => s.elt("strong"))

def(CodeMark, (_, s) => s.elt("code"))

def(LinkMark, (mark, s) => s.elt("a", {href: mark.attrs.href,
                                       title: mark.attrs.title}))

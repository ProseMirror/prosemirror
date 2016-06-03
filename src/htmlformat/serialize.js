const {Node} = require("../model")

// Object used to to expose relevant values and methods
// to DOM serializer functions.
class DOMSerializer {
  constructor(options) {
    // : Object The options passed to the serializer.
    this.options = options || {}
    // : DOMDocument The DOM document in which we are working.
    this.doc = this.options.document || window.document
  }

  renderNode(node, pos, offset) {
    let dom = this.renderStructure(node.type.toDOM(node), node.content, pos + 1)
    if (this.options.onRender)
      dom = this.options.onRender(node, dom, pos, offset) || dom
    return dom
  }

  renderStructure(structure, content, startPos) {
    if (typeof structure == "string")
      return this.doc.createTextNode(structure)
    if (structure.nodeType != null)
      return structure
    let dom = this.doc.createElement(structure[0]), attrs = structure[1], start = 1
    if (attrs && typeof attrs == "object" && attrs.nodeType == null && !Array.isArray(attrs)) {
      start = 2
      for (let name in attrs) {
        if (name == "style") dom.style.cssText = attrs[name]
        else if (attrs[name]) dom.setAttribute(name, attrs[name])
      }
    }
    for (let i = start; i < structure.length; i++) {
      let child = structure[i]
      if (child === 0) {
        if (!content)
          throw new RangeError("Content hole not allowed in a Mark spec (must produce a single node)")
        if (i < structure.length - 1 || i > start)
          throw new RangeError("Content hole must be the only child of its parent node")
        if (this.options.onContainer) this.options.onContainer(dom)
        this.renderFragment(content, dom, startPos)
      } else {
        dom.appendChild(this.renderStructure(child, content, startPos))
      }
    }
    return dom
  }

  renderFragment(fragment, where, startPos) {
    if (!where) where = this.doc.createDocumentFragment()
    if (fragment.size == 0) return where

    if (!fragment.firstChild.isInline)
      this.renderBlocksInto(fragment, where, startPos)
    else if (this.options.renderInlineFlat)
      this.renderInlineFlatInto(fragment, where, startPos)
    else
      this.renderInlineInto(fragment, where, startPos)
    return where
  }

  renderBlocksInto(fragment, where, startPos) {
    fragment.forEach((node, offset) => where.appendChild(this.renderNode(node, startPos + offset, offset)))
  }

  renderInlineInto(fragment, where, startPos) {
    let top = where
    let active = []
    fragment.forEach((node, offset) => {
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
      top.appendChild(this.renderNode(node, startPos + offset, offset))
    })
  }

  renderInlineFlatInto(fragment, where, startPos) {
    fragment.forEach((node, offset) => {
      let pos = startPos + offset, dom = this.renderNode(node, pos, offset)
      dom = this.wrapInlineFlat(dom, node.marks)
      dom = this.options.renderInlineFlat(node, dom, pos, offset) || dom
      where.appendChild(dom)
    })
  }

  renderMark(mark) {
    return this.renderStructure(mark.type.toDOM(mark))
  }

  wrapInlineFlat(dom, marks) {
    for (let i = marks.length - 1; i >= 0; i--) {
      let wrap = this.renderMark(marks[i])
      wrap.appendChild(dom)
      dom = wrap
    }
    return dom
  }
}

// :: (union<Node, Fragment>, ?Object) → DOMFragment
// Serialize the given content to a DOM fragment. When not
// in the browser, the `document` option, containing a DOM document,
// should be passed so that the serialize can create nodes.
//
// To define rendering behavior for your own [node](#NodeType) and
// [mark](#MarkType) types, give them a [`toDOM`](#NodeType.toDOM)
// method.
function toDOM(content, options) {
  return new DOMSerializer(options)
    .renderFragment(content instanceof Node ? content.content : content, null, options.pos || 0)
}
exports.toDOM = toDOM

// :: (Node) → DOMOutputSpec #path=NodeType.prototype.toDOM
// Defines the way the node should be serialized to DOM/HTML. Should
// return an [array structure](#DOMOutputSpec) that describes the
// resulting DOM structure, with an optional number zero (“hole”) in
// it to indicate where the node's content should be inserted.

// :: (Node) → DOMOutputSpec #path=MarkType.prototype.toDOM
// Defines the way the mark should be serialized to DOM/HTML.

// :: union<string, DOMNode, [any]> #path=DOMOutputSpec #kind=interface
// A description of a DOM structure. Strings are interpreted as text
// nodes. A DOM node simply means itself.
//
// An array describes a DOM element. The first element in the array
// should be a string, and is the name of the DOM element. If the
// second element is a non-Array, non-DOM node object, it is
// interpreted as an object providing the DOM element's attributes.
// Any elements after that (including the 2nd if it's not an attribute
// object) are interpreted as children of the DOM elements, and must
// either be valid `DOMOutputSpec` values, or the number zero.
//
// The number zero (pronounce “hole”) is used to indicate the place
// where a ProseMirror node's content should be inserted.

// :: (Node, ?Object) → DOMNode
// Serialize a given node to a DOM node. This is useful when you need
// to serialize a part of a document, as opposed to the whole
// document.
function nodeToDOM(node, options, offset) {
  let serializer = new DOMSerializer(options), pos = options.pos || 0
  let dom = serializer.renderNode(node, pos, offset)
  if (node.isInline) {
    dom = serializer.wrapInlineFlat(dom, node.marks)
    if (serializer.options.renderInlineFlat)
      dom = options.renderInlineFlat(node, dom, pos, offset) || dom
  }
  return dom
}
exports.nodeToDOM = nodeToDOM

// :: (union<Node, Fragment>, ?Object) → string
// Serialize a node as an HTML string. Goes through `toDOM` and then
// serializes the result. Again, you must pass a `document` option
// when not in the browser.
function toHTML(content, options) {
  let serializer = new DOMSerializer(options)
  let wrap = serializer.doc.createElement("div")
  wrap.appendChild(serializer.renderFragment(content instanceof Node ? content.content : content, null, options.pos || 0))
  return wrap.innerHTML
}
exports.toHTML = toHTML

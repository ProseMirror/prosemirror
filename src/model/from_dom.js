const {Fragment} = require("./fragment")
const {Mark} = require("./mark")

function parseDOM(schema, dom, options) {
  let topNode = options.topNode
  let top = new NodeBuilder(topNode ? topNode.type : schema.nodes.doc,
                            topNode ? topNode.attrs : null, true)
  let state = new DOMParseState(schema, options, top)
  state.addAll(dom, null, options.from, options.to)
  return top.finish()
}
exports.parseDOM = parseDOM

// : (ResolvedPos, DOMNode, ?Object) → Slice
// Parse a DOM fragment into a `Slice`, starting with the context at
// `$context`. If the DOM nodes are known to be 'open' (as in
// `Slice`), pass their left open depth as the `openLeft` option.
function parseDOMInContext($context, dom, options = {}) {
  let schema = $context.parent.type.schema

  let {builder, top} = builderFromContext($context)
  let openLeft = options.openLeft, startPos = $context.depth

  new class extends DOMParseState {
    enter(type, attrs) {
      if (openLeft == null) openLeft = type.isTextblock ? 1 : 0
      if (openLeft > 0 && this.top.match.matchType(type, attrs)) openLeft = 0
      if (openLeft == 0) return super.enter(type, attrs)

      openLeft--
      return null
    }
  }(schema, options, builder).addAll(dom)

  let openTo = top.openDepth, doc = top.finish(openTo), $startPos = doc.resolve(startPos)
  for (let d = $startPos.depth; d >= 0 && startPos == $startPos.end(d); d--) ++startPos
  return doc.slice(startPos, doc.content.size - openTo)
}
exports.parseDOMInContext = parseDOMInContext

function builderFromContext($context) {
  let top, builder
  for (let i = 0; i <= $context.depth; i++) {
    let node = $context.node(i), match = node.contentMatchAt($context.index(i))
    if (i == 0)
      builder = top = new NodeBuilder(node.type, node.attrs, true, null, match)
    else
      builder = builder.start(node.type, node.attrs, false, match)
  }
  return {builder, top}
}

// ;; #path=ParseSpec #kind=interface
// A value that describes how to parse a given DOM node as a
// ProseMirror node or mark type. Specifies the attributes of the new
// node or mark, along with optional information about the way the
// node's content should be treated.
//
// May either be a set of attributes, where `null` indicates the
// node's default attributes, or an array containing first a set of
// attributes and then an object describing the treatment of the
// node's content. Such an object may have the following properties:
//
// **`content`**`: ?union<bool, DOMNode>`
//   : If this is `false`, the content will be ignored. If it is not
//     given, the DOM node's children will be parsed as content of the
//     ProseMirror node or mark. If it is a DOM node, that DOM node's
//     content is treated as the content of the new node or mark (this
//     is useful if, for example, your DOM representation puts its
//     child nodes in an inner wrapping node).
//
// **`preserveWhiteSpace`**`: ?bool`
//   : When given, this enables or disables preserving of whitespace
//     when parsing the content.

class NodeBuilder {
  constructor(type, attrs, solid, prev, match) {
    // : NodeType
    // The type of the node being built
    this.type = type
    // : ContentMatch
    // The content match at this point, used to determine whether
    // other nodes may be added here.
    this.match = match || type.contentExpr.start(attrs)
    // : bool
    // True when the node is found in the source, and thus should be
    // preserved until its end. False when it was made up to provide a
    // wrapper for another node.
    this.solid = solid
    // : [Node]
    // The nodes that have been added so far.
    this.content = []
    // : ?NodeBuilder
    // The builder for the parent node, if any.
    this.prev = prev
    // : ?NodeBuilder
    // The builder for the last child, if that is still open (see
    // `NodeBuilder.start`)
    this.openChild = null
  }

  // : (Node) → ?Node
  // Try to add a node. Strip it of marks if necessary. Returns null
  // when the node doesn't fit here.
  add(node) {
    let matched = this.match.matchNode(node)
    if (!matched && node.marks.length) {
      node = node.mark(node.marks.filter(mark => this.match.allowsMark(mark.type)))
      matched = this.match.matchNode(node)
    }
    if (!matched) return null
    this.closeChild()
    this.content.push(node)
    this.match = matched
    return node
  }

  // : (NodeType, ?Object, bool, ?ContentMatch) → ?NodeBuilder
  // Try to start a new node at this point.
  start(type, attrs, solid, match) {
    let matched = this.match.matchType(type, attrs)
    if (!matched) return null
    this.closeChild()
    this.match = matched
    return this.openChild = new NodeBuilder(type, attrs, solid, this, match)
  }

  closeChild(openRight) {
    if (this.openChild) {
      this.content.push(this.openChild.finish(openRight && openRight - 1))
      this.openChild = null
    }
  }

  // : ()
  // Strip any trailing space text from the builder's content.
  stripTrailingSpace() {
    if (this.openChild) return
    let last = this.content[this.content.length - 1], m
    if (last && last.isText && (m = /\s+$/.exec(last.text))) {
      if (last.text.length == m[0].length) this.content.pop()
      else this.content[this.content.length - 1] = last.withText(last.text.slice(0, last.text.length - m[0].length))
    }
  }

  // : (?number) → Node
  // Finish this node. If `openRight` is > 0, the node (and `openRight
  // - 1` last children) is partial, and we don't need to 'close' it
  // by filling in required content.
  finish(openRight) {
    this.closeChild(openRight)
    let content = Fragment.from(this.content)
    if (!openRight) content = content.append(this.match.fillBefore(Fragment.empty, true))
    return this.type.create(this.match.attrs, content)
  }

  // : (NodeType, ?Object, ?Node) → ?NodeBuilder
  // Try to find a valid place to add a node with the given type and
  // attributes. When successful, if `node` was given, add it in its
  // entirety and return the builder to which it was added. If not,
  // start a node of the given type and return the builder for it.
  findPlace(type, attrs, node) {
    let route, builder
    for (let top = this;; top = top.prev) {
      let found = top.match.findWrapping(type, attrs)
      if (found && (!route || route.length > found.length)) {
        route = found
        builder = top
        if (!found.length) break
      }
      if (top.solid) break
    }

    if (!route) return null
    for (let i = 0; i < route.length; i++)
      builder = builder.start(route[i].type, route[i].attrs, false)
    return node ? builder.add(node) && builder : builder.start(type, attrs, true)
  }

  get depth() {
    let d = 0
    for (let b = this.prev; b; b = b.prev) d++
    return d
  }

  get openDepth() {
    let d = 0
    for (let c = this.openChild; c; c = c.openChild) d++
    return d
  }

  get posBeforeLastChild() {
    let pos = this.prev ? this.prev.posBeforeLastChild + 1 : 0
    for (let i = 0; i < this.content.length; i++)
      pos += this.content[i].nodeSize
    return pos
  }

  get currentPos() {
    this.closeChild()
    return this.posBeforeLastChild
  }
}

// : Object<bool> The block-level tags in HTML5
const blockTags = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
}

// : Object<bool> The tags that we normally ignore.
const ignoreTags = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
}

// : Object<bool> List tags.
const listTags = {ol: true, ul: true}

// A state object used to track context during a parse.
class DOMParseState {
  // : (Schema, Object, NodeBuilder)
  constructor(schema, options, top) {
    // : Object The options passed to this parse.
    this.options = options || {}
    // : Schema The schema that we are parsing into.
    this.schema = schema
    this.top = top
    // : [Mark] The current set of marks
    this.marks = Mark.none
    // : bool Whether to preserve whitespace
    this.preserveWhitespace = this.options.preserveWhitespace
    this.info = schemaInfo(schema)
    this.find = options.findPositions
  }

  // : (Mark) → [Mark]
  // Add a mark to the current set of marks, return the old set.
  addMark(mark) {
    let old = this.marks
    this.marks = mark.addToSet(this.marks)
    return old
  }

  // : (DOMNode)
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(dom) {
    if (dom.nodeType == 3) {
      let value = dom.nodeValue
      let top = this.top
      if (/\S/.test(value) || top.type.isTextblock) {
        if (!this.preserveWhitespace) {
          value = value.replace(/\s+/g, " ")
          // If this starts with whitespace, and there is either no node
          // before it or a node that ends with whitespace, strip the
          // leading space.
          if (/^\s/.test(value)) top.stripTrailingSpace()
        }
        if (value)
          this.insertNode(this.schema.text(value, this.marks))
        this.findInText(dom)
      } else {
        this.findInside(dom)
      }
    } else if (dom.nodeType == 1 && !dom.hasAttribute("pm-ignore")) {
      let style = dom.getAttribute("style")
      if (style) this.addElementWithStyles(parseStyles(style), dom)
      else this.addElement(dom)
    }
  }

  // : (DOMNode)
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(dom) {
    let name = dom.nodeName.toLowerCase()
    if (listTags.hasOwnProperty(name)) this.normalizeList(dom)
    // Ignore trailing BR nodes, which browsers create during editing
    if (this.options.editableContent && name == "br" && !dom.nextSibling) return
    if (!this.parseNodeType(dom, name)) {
      if (ignoreTags.hasOwnProperty(name)) {
        this.findInside(dom)
      } else {
        let sync = blockTags.hasOwnProperty(name) && this.top
        this.addAll(dom)
        if (sync) this.sync(sync)
      }
    }
  }

  // Run any style parser associated with the node's styles. After
  // that, if no style parser suppressed the node's content, pass it
  // through to `addElement`.
  addElementWithStyles(styles, dom) {
    let oldMarks = this.marks, marks = this.marks
    for (let i = 0; i < styles.length; i += 2) {
      let result = matchStyle(this.info.styles, styles[i], styles[i + 1])
      if (!result) continue
      if (result.attrs === false) return
      marks = result.mark.create(result.attrs).addToSet(marks)
    }
    this.marks = marks
    this.addElement(dom)
    this.marks = oldMarks
  }

  // (DOMNode, string) → bool
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  parseNodeType(dom) {
    let result = matchTag(this.info.selectors, dom)
    if (!result) return false

    let sync, before
    if (result.node && result.node.isLeaf) this.insertNode(result.node.create(result.attrs))
    else if (result.node) sync = this.enter(result.node, result.attrs)
    else before = this.addMark(result.mark.create(result.attrs))

    let contentNode = dom, preserve = null, prevPreserve = this.preserveWhitespace
    if (result.content) {
      if (result.content.content === false) contentNode = null
      else if (result.content.content) contentNode = result.content.content
      preserve = result.content.preserveWhitespace
    } else if (result.node && result.node.isLeaf) {
      contentNode = null
    }

    if (contentNode) {
      this.findAround(dom, contentNode, true)
      if (preserve != null) this.preserveWhitespace = preserve
      this.addAll(contentNode, sync)
      if (sync) this.sync(sync.prev)
      else if (before) this.marks = before
      if (preserve != null) this.preserveWhitespace = prevPreserve
      this.findAround(dom, contentNode, true)
    } else {
      this.findInside(dom)
    }
    return true
  }

  // : (DOMNode, ?NodeBuilder, ?number, ?number)
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(parent, sync, startIndex, endIndex) {
    let index = startIndex || 0
    for (let dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild,
             end = endIndex == null ? null : parent.childNodes[endIndex];
         dom != end; dom = dom.nextSibling, ++index) {
      this.findAtPoint(parent, index)
      this.addDOM(dom)
      if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase()))
        this.sync(sync)
    }
    this.findAtPoint(parent, index)
  }

  // : (Node) → ?Node
  // Try to insert the given node, adjusting the context when needed.
  insertNode(node) {
    let ok = this.top.findPlace(node.type, node.attrs, node)
    if (ok) {
      this.sync(ok)
      return true
    }
  }

  // : (NodeType, ?Object) → ?NodeBuilder
  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(type, attrs) {
    let ok = this.top.findPlace(type, attrs)
    if (ok) {
      this.sync(ok)
      return ok
    }
  }

  // : ()
  // Leave the node currently at the top.
  leave() {
    if (!this.preserveWhitespace) this.top.stripTrailingSpace()
    this.top = this.top.prev
  }

  sync(to) {
    for (;;) {
      for (let cur = to; cur; cur = cur.prev) if (cur == this.top) {
        this.top = to
        return
      }
      this.leave()
    }
  }

  // Kludge to work around directly nested list nodes produced by some
  // tools and allowed by browsers to mean that the nested list is
  // actually part of the list item above it.
  normalizeList(dom) {
    for (let child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
      let name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null
      if (name && listTags.hasOwnProperty(name) && prevItem) {
        prevItem.appendChild(child)
        child = prevItem
      } else if (name == "li") {
        prevItem = child
      } else if (name) {
        prevItem = null
      }
    }
  }

  findAtPoint(parent, offset) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == parent && this.find[i].offset == offset)
        this.find[i].pos = this.top.currentPos
    }
  }

  findInside(parent) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.contains(this.find[i].node))
        this.find[i].pos = this.top.currentPos
    }
  }

  findAround(parent, content, before) {
    if (parent != content && this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.contains(this.find[i].node)) {
        let pos = content.compareDocumentPosition(this.find[i].node)
        if (pos & (before ? 2 : 4))
          this.find[i].pos = this.top.currentPos
      }
    }
  }

  findInText(textNode) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == textNode)
        this.find[i].pos = this.top.currentPos - (textNode.nodeValue.length - this.find[i].offset)
    }
  }
}

// Apply a CSS selector.
function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector)
}

// : (string) → [string]
// Tokenize a style attribute into property/value pairs.
function parseStyles(style) {
  let re = /\s*([\w-]+)\s*:\s*([^;]+)/g, m, result = []
  while (m = re.exec(style)) result.push(m[1], m[2].trim())
  return result
}

function schemaInfo(schema) {
  return schema.cached.parseDOMInfo || (schema.cached.parseDOMInfo = summarizeSchemaInfo(schema))
}

function summarizeSchemaInfo(schema) {
  let selectors = [], styles = []
  for (let name in schema.nodes) {
    let type = schema.nodes[name], match = type.matchDOMTag
    if (match) for (let selector in match)
      selectors.push({selector, node: type, value: match[selector]})
  }
  for (let name in schema.marks) {
    let type = schema.marks[name], match = type.matchDOMTag, props = type.matchDOMStyle
    if (match) for (let selector in match)
      selectors.push({selector, mark: type, value: match[selector]})
    if (props) for (let prop in props)
      styles.push({prop, mark: type, value: props[prop]})
  }
  return {selectors, styles}
}

function matchTag(selectors, dom) {
  for (let i = 0; i < selectors.length; i++) {
    let cur = selectors[i]
    if (matches(dom, cur.selector)) {
      let value = cur.value, content
      if (value instanceof Function) {
        value = value(dom)
        if (value === false) continue
      }
      if (Array.isArray(value)) {
        ;([value, content] = value)
      }
      return {node: cur.node, mark: cur.mark, attrs: value, content}
    }
  }
}

function matchStyle(styles, prop, value) {
  for (let i = 0; i < styles.length; i++) {
    let cur = styles[i]
    if (cur.prop == prop) {
      let attrs = cur.value
      if (attrs instanceof Function) {
        attrs = attrs(value)
        if (attrs === false) continue
      }
      return {mark: cur.mark, attrs}
    }
  }
}

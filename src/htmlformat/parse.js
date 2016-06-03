const {Fragment, NodeType} = require("../model")

// :: (Schema, DOMNode, ?Object) → Node
// Parse document from the content of a DOM node. To pass an explicit
// parent document (for example, when not in a browser window
// environment, where we simply use the global document), pass it as
// the `document` property of `options`.
function fromDOM(schema, dom, options = {}) {
  let topNode = options.topNode
  let top = new NodeBuilder(topNode ? topNode.type : schema.nodes.doc,
                            topNode ? topNode.attrs : null, true)
  let context = new DOMParseState(schema, options, top)
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end)
  return top.finish()
}
exports.fromDOM = fromDOM

// :: (ResolvedPos, DOMNode, number, number, ?Object) → Slice
// Parse a DOM fragment into a `Slice`, starting with the context at
// `$context`. If the DOM nodes are known to be 'open' (as in
// `Slice`), pass their open depth as `openLeft` and `openRight`.
function fromDOMInContext($context, dom, options = {}) {
  let {builder, top, left} = builderFromContext($context, dom)
  let context = new DOMParseState($context.node(0).type.schema, options, builder)
  context.addAll(dom.firstChild, null)

  let openLeft = options.openLeft != null ? options.openLeft : left && left.isTextblock ? 1 : 0
  let openRight = options.openRight
  if (openRight == null) {
    let right = parseInfoAtSide(top.type.schema, dom, 1)
    openRight = right && right.isTextblock ? 1 : 0
  }

  let openTo = Math.min(top.openDepth, builder.depth + openRight)
  let doc = top.finish(openTo), maxOpenLeft = 0
  for (let node = doc.firstChild; node && !node.type.isLeaf; node = node.firstChild) ++maxOpenLeft
  return doc.slice(Math.min(builder.depth + openLeft, maxOpenLeft), doc.content.size - openTo)
}
exports.fromDOMInContext = fromDOMInContext

function builderFromContext($context, dom) {
  let topNode = $context.node(0), matches = []
  for (let i = 0; i < $context.depth; i++)
    matches.push($context.node(i).contentMatchAt($context.indexAfter(i)))
  let left = parseInfoAtSide(topNode.type.schema, dom, -1), start = $context.depth, wrap = []
  search: if (left) {
    for (let i = matches.length - 1; i >= 0; i--)
      if (matches[i].matchType(left.type, left.attrs, noMarks)) {
        start = i
        break search
      }
    for (let i = matches.length - 1, wrapping; i >= 0; i--)
      if (wrapping = matches[i].findWrapping(left.type, left.attrs)) {
        start = i
        wrap = wrapping
        break search
      }
  }
  let top = new NodeBuilder(topNode.type, topNode.attrs, true), builder = top
  for (let i = 1; i <= start; i++) {
    let node = $context.node(i)
    builder = builder.start(node.type, node.attrs, true, matches[i])
  }
  for (let i = 0; i < wrap.length; i++)
    builder = builder.start(wrap[i].type, wrap[i].attrs, false)
  return {builder, top, left}
}

function parseInfoAtSide(schema, dom, side) {
  let info = schemaInfo(schema).selectors
  for (let cur = dom, next;; cur = next) {
    next = cur && (side > 0 ? cur.lastChild || cur.previousSibling : cur.firstChild || cur.nextSibling)
    if (!next && cur != dom)
      next = side > 0 ? cur.parentNode.previousSibling : cur.parentNode.nextSibling
    if (!next) return null
    if (next.nodeType == 1) {
      let result = matchTag(info, next)
      if (result && result.type instanceof NodeType)
        return result.type.create(result.attrs)
    }
    cur = next
  }
}

// :: (Schema, string, ?Object) → Node
// Parses the HTML into a DOM, and then calls through to `fromDOM`.
function fromHTML(schema, html, options) {
  let wrap = (options && options.document || window.document).createElement("div")
  wrap.innerHTML = html
  return fromDOM(schema, wrap, options)
}
exports.fromHTML = fromHTML

// :: union<?Object, [?Object, {content: ?union<bool, DOMNode>, preserveWhiteSpace: ?bool}]>
// #path=ParseSpec #kind=interface
// A value that describes how to parse a given DOM node as a
// ProseMirror node or mark type. Specifies the attributes of the new
// node or mark, along with optional information about the way the
// node's content should be treated.
//
// May either be a set of attributes, where `null` indicates the
// node's default attributes, or an array containing first a set of
// attributes and then an object describing the treatment of the
// node's content. If the `content` property is `false`, the content
// will be ignored. If it is not given, the DOM node's children will
// be parsed as content of the ProseMirror node or mark. If it is a
// DOM node, that DOM node's content is treated as the content of the
// new node or mark (this is useful if, for example, your DOM
// representation puts its child nodes in an inner wrapping node). You
// can set `preserveWhiteSpace` to a boolean to enable or disable
// preserving of whitespace when parsing the content.

// :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>> #path=NodeType.prototype.matchDOMTag
// Defines the way nodes of this type are parsed. Should contain an
// object mapping CSS selectors (such as `"p"` for `<p>` tags, or
// `div[data-type="foo"]` for `<div>` tags with a specific attribute)
// to [parse specs](#ParseSpec) or functions that, when given a DOM
// node, return either `false` or a parse spec.

// :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>> #path=MarkType.prototype.matchDOMTag
// Defines the way marks of this type are parsed. Works just like
// `NodeType.matchTag`, but produces marks rather than nodes.

// :: Object<union<?Object, (string) → union<bool, ?Object>>> #path=MarkType.prototype.matchDOMStyle
// Defines the way DOM styles are mapped to marks of this type. Should
// contain an object mapping CSS property names, as found in inline
// styles, to either attributes for this mark (null for default
// attributes), or a function mapping the style's value to either a
// set of attributes or `false` to indicate that the style does not
// match.

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
    let matched = this.match.matchType(type, attrs, noMarks)
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
      else this.content[this.content.length - 1] = last.copy(last.text.slice(0, last.text.length - m[0].length))
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
    for (let top = this;; top = top.prev) {
      let ok = node ? top.add(node) && top : top.start(type, attrs, true)
      if (ok) return ok
      if (top.solid) break
    }

    for (let top = this;; top = top.prev) {
      let route = top.match.findWrapping(type, attrs)
      if (route) {
        for (let i = 0; i < route.length; i++)
          top = top.start(route[i].type, route[i].attrs, false)
        return node ? top.add(node) && top : top.start(type, attrs, true)
      } else if (top.solid) {
        return null
      }
    }
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

const noMarks = []

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
    this.marks = noMarks
    // : bool Whether to preserve whitespace
    this.preserveWhitespace = this.options.preserveWhitespace
    this.info = schemaInfo(schema)
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
    if (!this.parseNodeType(dom, name) && !ignoreTags.hasOwnProperty(name)) {
      let sync = blockTags.hasOwnProperty(name) && this.top
      this.addAll(dom.firstChild, null)
      if (sync) this.sync(sync)
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
      marks = result.type.create(result.attrs).addToSet(marks)
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

    let isNode = result.type instanceof NodeType, sync, before
    if (isNode) sync = this.enter(result.type, result.attrs)
    else before = this.addMark(result.type.create(result.attrs))

    let contentNode = dom, preserve = null, prevPreserve = this.preserveWhitespace
    if (result.content) {
      if (result.content.content === false) contentNode = null
      else if (result.content.content) contentNode = result.content.content
      preserve = result.content.preserveWhitespace
    }

    if (contentNode) {
      if (preserve != null) this.preserveWhitespace = preserve
      this.addAll(contentNode.firstChild, null, sync)
      if (sync) this.sync(sync.prev)
      else if (before) this.marks = before
      if (preserve != null) this.preserveWhitespace = prevPreserve
    }
    return true
  }

  // : (?DOMNode, ?DOMNode, ?NodeBuilder)
  // Add all nodes between `from` and `to` (via `nextSibling`). If
  // `sync` is passed, use it to synchronize after every block
  // element.
  addAll(from, to, sync) {
    for (let dom = from; dom != to; dom = dom.nextSibling) {
      this.addDOM(dom)
      if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase()))
        this.sync(sync)
    }
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

  // : (NodeType, ?Object, [Node]) → ?Node
  // Insert a node of the given type, with the given content, based on
  // `dom`, at the current position in the document.
  insert(type, attrs, content) {
    let node = type.createAndFill(attrs, content, type.isInline ? this.marks : null)
    if (node) this.insertNode(node)
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
    for (let child = dom.firstChild, prev; child; child = child.nextSibling) {
      if (child.nodeType == 1 &&
          listTags.hasOwnProperty(child.nodeName.toLowerCase()) &&
          (prev = child.previousSibling)) {
        prev.appendChild(child)
        child = prev
      }
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
      selectors.push({selector, type, value: match[selector]})
  }
  for (let name in schema.marks) {
    let type = schema.marks[name], match = type.matchDOMTag, props = type.matchDOMStyle
    if (match) for (let selector in match)
      selectors.push({selector, type, value: match[selector]})
    if (props) for (let prop in props)
      styles.push({prop, type, value: props[prop]})
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
      return {type: cur.type, attrs: value, content}
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
      return {type: cur.type, attrs}
    }
  }
}

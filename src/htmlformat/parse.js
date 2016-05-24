import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark, Fragment} from "../model"
import sortedInsert from "../util/sortedinsert"

// :: (Schema, DOMNode, ?Object) → Node
// Parse document from the content of a DOM node. To pass an explicit
// parent document (for example, when not in a browser window
// environment, where we simply use the global document), pass it as
// the `document` property of `options`.
export function fromDOM(schema, dom, options = {}) {
  let topNode = options.topNode
  let top = new NodeBuilder(topNode ? topNode.type : schema.nodes.doc,
                            topNode ? topNode.attrs : null, true)
  let context = new DOMParseState(schema, options, top)
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end)
  return top.finish()
}

// :: (ResolvedPos, DOMNode, number, number, ?Object) → Slice
// Parse a DOM fragment into a `Slice`, starting with the context at
// `$context`. If the DOM nodes are known to be 'open' (as in
// `Slice`), pass their open depth as `openLeft` and `openRight`.
export function fromDOMInContext($context, dom, options = {}) {
  let {builder, top, left} = builderFromContext($context, dom)
  let context = new DOMParseState($context.node(0).type.schema, options, builder)
  context.addAll(dom.firstChild, null)

  let openLeft = options.openLeft != null ? options.openLeft : left && left.node.isTextblock ? 1 : 0
  let openRight = options.openRight
  if (openRight == null) {
    let right = parseInfoAtSide(top.type.schema, dom, 1)
    openRight = right && right.node.isTextblock ? 1 : 0
  }

  let openTo = Math.min(top.openDepth, builder.depth + openRight)
  let doc = top.finish(openTo), maxOpenLeft = 0
  for (let node = doc.firstChild; node && !node.type.isLeaf; node = node.firstChild) ++maxOpenLeft
  return doc.slice(Math.min(builder.depth + openLeft, maxOpenLeft), doc.content.size - openTo)
}

function builderFromContext($context, dom) {
  let topNode = $context.node(0), matches = []
  for (let i = 0; i < $context.depth; i++)
    matches.push($context.node(i).contentMatchAt($context.indexAfter(i)))
  let left = parseInfoAtSide(topNode.type.schema, dom, -1), start = $context.depth, wrap = []
  search: if (left) {
    for (let i = matches.length - 1; i >= 0; i--)
      if (matches[i].matchType(left.node, left.attrs, noMarks)) {
        start = i
        break search
      }
    for (let i = matches.length - 1, wrapping; i >= 0; i--)
      if (wrapping = matches[i].findWrapping(left.node, left.attrs)) {
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
  let info = schemaInfo(schema).tags
  for (let cur = dom, next;; cur = next) {
    next = cur && (side > 0 ? cur.lastChild || cur.previousSibling : cur.firstChild || cur.nextSibling)
    if (!next && cur != dom)
      next = side > 0 ? cur.parentNode.previousSibling : cur.parentNode.nextSibling
    if (!next) return null
    if (next.nodeType == 1) {
      let result = findMatchingHandler(info, next)
      if (result && result.node) return result
    }
    cur = next
  }
}

// :: (Schema, string, ?Object) → Node
// Parses the HTML into a DOM, and then calls through to `fromDOM`.
export function fromHTML(schema, html, options) {
  let wrap = (options && options.document || window.document).createElement("div")
  wrap.innerHTML = html
  return fromDOM(schema, wrap, options)
}

// ;; #path=DOMParseSpec #kind=interface
// To define the way [node](#NodeType) and [mark](#MarkType) types are
// parsed, you can associate one or more DOM parsing specifications to
// them using the [`register`](#SchemaItem.register) method with the
// `"parseDOM"` namespace, using the HTML node name (lowercase) as
// value name. Each of them defines a parsing strategy for a certain
// type of DOM node. When `"_"` is used as name, the parser is
// activated for all nodes.

// :: ?number #path=DOMParseSpec.rank
// The precedence of this parsing strategy. Should be a number between
// 0 and 100, which determines when this parser gets a chance relative
// to others that apply to the node (low ranks go first). Defaults to
// 50.

// :: (dom: DOMNode) → ?Object> #path=DOMParseSpec.parse
// The function that, given a DOM node, returns the way that it wraps
// its content in a ProseMirror node or mark. It should return null
// when it wants to indicate that it was not able to parse this node.
// Otherwise, it must return an object like `{node: ?NodeType, mark:
// ?MarkType, attrs: ?Object, content: ?union<DOMNode, Fragment>}`,
// where either `node` or `mark` has a value, indicating the content
// (given either as further DOM content to parse, or as a finished
// `Fragment`) should be wrapped in such a node or mark.

// :: ?string #path=DOMParseSpec.selector
// A css selector to match against. If present, it will try to match the selector
// against the dom node prior to calling the parse function.

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
    let info = schemaInfo(schema)
    this.tagInfo = info.tags
    this.styleInfo = info.styles
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
        if (!this.options.preserveWhitespace) {
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
    let resetMarks = this.marks
    for (let i = 0; i < styles.length; i += 2) {
      let parsers = this.styleInfo[styles[i]], value = styles[i + 1]
      if (parsers) for (let j = 0; j < parsers.length; j++) {
        let parser = parsers[j]
        let result = parser.parse.call(parser.type, value, dom)
        if (!result) continue
        if (!(dom = result.content)) break
        if (result.mark) this.addMark(result.mark.create(result.attrs))
      }
    }
    if (dom) this.addElement(dom)
    this.marks = resetMarks
  }

  // (DOMNode, string) → bool
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  parseNodeType(dom, name) {
    let result = findMatchingHandler(this.tagInfo, dom, name)
    if (!result) return false

    if (result.mark && result.content) {
      let before = this.addMark(result.mark.create(result.attrs))
      this.addAll(result.content.firstChild, null)
      this.marks = before
    } else if (result.node) {
      if (result.content && result.content.nodeType) {
        let sync = this.enter(result.node, result.attrs)
        this.addAll(result.content.firstChild, null, sync)
        if (sync) this.sync(sync.prev)
      } else {
        this.insert(result.node, result.attrs, result.content || Fragment.empty)
      }
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
    let frag = type.fixContent(Fragment.from(content), attrs)
    if (!frag) return null
    this.insertNode(type.create(attrs, frag, type.isInline ? this.marks : null))
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
    if (!this.options.preserveWhitespace) this.top.stripTrailingSpace()
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
  let tags = Object.create(null), styles = Object.create(null)
  tags._ = []
  schema.registry("parseDOM", (tag, info, type) => {
    let parse = info.parse
    sortedInsert(tags[tag] || (tags[tag] = []), {
      type, parse,
      selector: info.selector,
      rank: info.rank == null ? 50 : info.rank
    }, (a, b) => a.rank - b.rank)
  })
  schema.registry("parseDOMStyle", (style, info, type) => {
    sortedInsert(styles[style] || (styles[style] = []), {
      type,
      parse: info.parse,
      rank: info.rank == null ? 50 : info.rank
    }, (a, b) => a.rank - b.rank)
  })
  return {tags, styles}
}

function findMatchingHandler(tagInfo, dom, name) {
  for (let i = 0; i < 2; i++) {
    let handlers = tagInfo[i ? "_" : name || dom.nodeName.toLowerCase()]
    if (handlers) for (let j = 0; j < handlers.length; j++) {
      let handler = handlers[j], result
      if ((!handler.selector || matches(dom, handler.selector)) &&
          (result = handler.parse.call(handler.type, dom)))
        return result
    }
  }
}

function wrapNode(dom) { return {node: this, content: dom} }

Paragraph.register("parseDOM", "p", {parse: wrapNode})

BlockQuote.register("parseDOM", "blockquote", {parse: wrapNode})

for (let i = 1; i <= 6; i++) Heading.registerComputed("parseDOM", "h" + i, type => {
  if (i <= type.maxLevel) return {
    parse(dom) { return {node: this, attrs: {level: i}, content: dom} }
  }
})

HorizontalRule.register("parseDOM", "hr", {parse: wrapNode})

CodeBlock.register("parseDOM", "pre", {parse(dom) {
  let text = dom.textContent
  return {node: this, content: Fragment.from(text ? this.schema.text(dom.textContent) : null)}
}})

BulletList.register("parseDOM", "ul", {parse: wrapNode})

OrderedList.register("parseDOM", "ol", {parse(dom) {
  let start = dom.getAttribute("start")
  return {node: this, attrs: {order: start ? +start : 1}, content: dom}
}})

ListItem.register("parseDOM", "li", {parse: wrapNode})

HardBreak.register("parseDOM", "br", {parse: wrapNode})

Image.register("parseDOM", "img", {parse(dom) {
  return {node: this, attrs: {
    src: dom.getAttribute("src"),
    title: dom.getAttribute("title") || null,
    alt: dom.getAttribute("alt") || null
  }}
}})

// Inline style tokens

LinkMark.register("parseDOM", "a", {
  parse(dom) {
    let attrs = {href: dom.getAttribute("href"), title: dom.getAttribute("title")}
    return {mark: this, attrs, content: dom}
  },
  selector: "[href]"
})

function wrapMark(dom) {
  return {mark: this, content: dom}
}

EmMark.register("parseDOM", "i", {parse: wrapMark})
EmMark.register("parseDOM", "em", {parse: wrapMark})
EmMark.register("parseDOMStyle", "font-style", {parse(value, dom) {
  return {mark: value == "italic" ? this : null, content: dom}
}})

StrongMark.register("parseDOM", "b", {parse: wrapMark})
StrongMark.register("parseDOM", "strong", {parse: wrapMark})
StrongMark.register("parseDOMStyle", "font-weight", {parse(value, dom) {
  let isBold = value == "bold" || value == "bolder" || !/\D/.test(value) && +value >= 500
  return {mark: isBold ? this : null, content: dom}
}})

CodeMark.register("parseDOM", "code", {parse: wrapMark})

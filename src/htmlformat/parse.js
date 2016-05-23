import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark, Fragment} from "../model"
import sortedInsert from "../util/sortedinsert"
import {compareDeep} from "../util/comparedeep"

export function fromDOM(schema, dom, options = {}) {
  let topNode = options.topNode
  let top = new NodeBuilder(topNode ? topNode.type : schema.nodes.doc,
                            topNode ? topNode.attrs : null)
  let context = new DOMParseState(schema, options, top)
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end)
  return top.finish()
}

export function fromDOMInContext($context, dom, openLeft, openRight, options = {}) {
  let context = new DOMParseState($context.node(0).type.schema, options)
  for (let i = 0; i <= $context.depth; i++) {
    let node = $context.node(i)
    context.enter(node.type, node.attrs, node.contentMatchAt($context.index(i)))
  }

  // FIXME remove this, pass responsibility of skipping these opens to context
  // Make context delay closes to implement openRight etc
  for (let i = openLeft; i >= 0; i--) {
    let cur = dom
    for (let j = 0; j < i; j++) cur = cur.firstChild
    context.addAll(cur.childNodes[i < openLeft ? 1 : 0], null)
  }
  let endOffset = 0, lastNode = context.top.content[context.top.content.length - 1]
  for (let i = 0; i < openRight && lastNode && !lastNode.type.isLeaf; i++) {
    endOffset++
    lastNode = lastNode.lastSibling
  }
  while (context.stack.length > 1) { context.leave(true); endOffset++ }
  let doc = context.leave(true)
  return doc.slice($context.depth, doc.content.size - endOffset)
}

export function typeForDOM(schema, dom) {
  let result = findMatchingHandler(schemaInfo(schema).tags, dom)
  return result && result.node
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
// The function that, given a DOM node, parses it, updating the parse
// state. It should return (the exact value) `false` when it wants to
// indicate that it was not able to parse this node. This function is
// called in such a way that `this` is bound to the type that the
// parse spec was associated with.

// :: ?string #path=DOMParseSpec.selector
// A css selector to match against. If present, it will try to match the selector
// against the dom node prior to calling the parse function.

class NodeBuilder {
  constructor(type, attrs, prev, match) {
    this.type = type
    this.match = match || type.contentExpr.start(attrs)
    this.content = []
    this.prev = prev
    this.openChild = null
  }

  add(node) {
    this.closeChild()
    let matched = this.match.matchNode(node)
    if (!matched && node.marks.length) {
      node = node.mark(node.marks.filter(mark => this.match.allowsMark(mark.type)))
      matched = this.match.matchNode(node)
    }
    if (!matched) return null
    this.content.push(node)
    this.match = matched
    return node
  }

  start(type, attrs) {
    this.closeChild()
    let matched = this.match.matchType(type, attrs, noMarks)
    if (matched) {
      this.match = matched
      return this.openChild = new NodeBuilder(type, attrs, this)
    }
  }

  closeChild(open) {
    if (this.openChild) {
      this.content.push(this.openChild.finish(open))
      this.openChild = null
    }
  }

  stripTrailingSpace() {
    if (this.openChild) return
    let last = this.content[this.content.length - 1], m
    if (last && last.isText && (m = /\s+$/.exec(last.text))) {
      if (last.text.length == m[0].length) this.content.pop()
      else this.content[this.content.length - 1] = last.copy(last.text.slice(0, last.text.length - m[0].length))
    }
  }

  finish(open) {
    this.closeChild(open)
    let content = Fragment.from(this.content)
    if (!open) content = content.append(this.match.fillBefore(Fragment.empty, true))
    return this.type.create(this.match.attrs, content)
  }

  sameStructure(other) {
    if (other == this) return true
    if (!other || other.type != this.type || !compareDeep(this.attrs, other.attrs)) return false
    return this.prev ? this.prev.sameStructure(other.prev) : !other.prev
  }
}

const blockElements = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
}

const ignoreElements = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
}

const listElements = {ol: true, ul: true}

const noMarks = []

// ;; A state object used to track context during a parse,
// and to expose methods to custom parsing functions.
class DOMParseState {
  constructor(schema, options, top) {
    // :: Object The options passed to this parse.
    this.options = options || {}
    // :: Schema The schema that we are parsing into.
    this.schema = schema
    this.top = top
    this.marks = noMarks
    let info = schemaInfo(schema)
    this.tagInfo = info.tags
    this.styleInfo = info.styles
  }

  addMark(mark) {
    let old = this.marks
    this.marks = mark.addToSet(this.marks)
    return old
  }

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

  addElement(dom) {
    let name = dom.nodeName.toLowerCase()
    if (listElements.hasOwnProperty(name)) this.normalizeList(dom)
    // Ignore trailing BR nodes, which browsers create during editing
    if (this.options.editableContent && name == "br" && !dom.nextSibling) return
    if (!this.parseNodeType(dom, name) && !ignoreElements.hasOwnProperty(name)) {
      let sync = blockElements.hasOwnProperty(name) && this.top
      this.addAll(dom.firstChild, null)
      if (sync) this.sync(sync)
    }
  }

  addElementWithStyles(styles, dom) {
    let resetMarks = this.marks
    for (let i = 0; i < styles.length; i += 2) {
      let parsers = this.styleInfo[styles[i]], value = styles[i + 1]
      if (parsers) for (let j = 0; j < parsers.length; j++) {
        let parser = parsers[j]
        let result = parser.parse.call(parser.type, value, dom, this.options)
        if (!result) continue
        if (!(dom = result.content)) break
        if (result.mark) this.addMark(result.mark.create(result.attrs))
      }
    }
    if (dom) this.addElement(dom)
    this.marks = resetMarks
  }

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

  addAll(from, to, sync) {
    for (let dom = from; dom != to; dom = dom.nextSibling) {
      this.addDOM(dom)
      if (sync && blockElements.hasOwnProperty(dom.nodeName.toLowerCase()))
        this.sync(sync)
    }
  }

  findPlace(type, attrs, node) {
    let ok = node ? this.top.add(node) : this.top.start(type, attrs)
    if (ok) return ok

    let found
    for (let top = this.top; top; top = top.prev) {
      let route = top.match.findWrapping(type, attrs)
      if (!route) continue
      while (this.top != top) this.leave()
      found = route
      break
    }
    if (!found) return false
    for (let i = 0; i < found.length; i++)
      this.top = this.top.start(found[i].type, found[i].attrs)

    return node ? this.top.add(node) : this.top.start(type, attrs)
  }

  insertNode(node) {
    this.findPlace(node.type, node.attrs, node)
  }

  // : (NodeType, ?Object, [Node]) → ?Node
  // Insert a node of the given type, with the given content, based on
  // `dom`, at the current position in the document.
  insert(type, attrs, content) {
    let frag = type.fixContent(Fragment.from(content), attrs)
    if (!frag) return null
    this.insertNode(type.create(attrs, frag, type.isInline ? this.marks : null))
  }

  enter(type, attrs) {
    let newTop = this.findPlace(type, attrs)
    if (newTop) return this.top = newTop
  }

  leave() {
    if (!this.options.preserveWhitespace) this.top.stripTrailingSpace()
    this.top = this.top.prev
  }

  sync(to) {
    if (to == this.top) return

    for (;;) {
      for (let goal = to, toAdd = []; goal; goal = goal.prev) {
        if (this.top.sameStructure(goal)) {
          for (let i = 0; i < toAdd.length; i++)
            this.enter(toAdd[i].type, toAdd[i].attrs)
          return
        } else {
          toAdd.push(goal)
        }
      }
      this.leave()
    }
  }

  normalizeList(dom) {
    for (let child = dom.firstChild, prev; child; child = child.nextSibling) {
      if (child.nodeType == 1 &&
          listElements.hasOwnProperty(child.nodeName.toLowerCase()) &&
          (prev = child.previousSibling)) {
        prev.appendChild(child)
        child = prev
      }
    }
  }
}

function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector)
}

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
          (result = handler.parse.call(handler.type, dom, this.options)))
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

import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark, Node} from "../model"
import {defineSource} from "./index"

// :: (Schema, DOMNode, ?Object) → Node
// Parse document from the content of a DOM node. To pass an explicit
// parent document (for example, when not in a browser window
// environment, where we simply use the global document), pass it as
// the `document` property of `options`.
export function fromDOM(schema, dom, options) {
  if (!options) options = {}
  let context = new DOMParseState(schema, options.topNode || schema.node("doc"), options)
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end, true)
  let doc
  while (context.stack.length) doc = context.leave()
  return doc
}

// ;; #path=DOMParseSpec #kind=interface #toc=false
// To define the way [node](#NodeType) and [mark](#MarkType) types are
// parsed, you can associate one or more DOM parsing specifications to
// them using the [`register`](#NodeType.register) method with the
// `parseDOM` property name. Each of them defines a parsing strategy
// for a certain type of DOM node.
//
// Note that `Attribute`s may also contain a `parseDOM` property,
// which should _not_ be a `DOMParseSpec`, but simply a function that
// computes the attribute's value from a DOM node.

// :: ?string #path=DOMParseSpec.tag
// The (lower-case) tag name for which to activate this parser. When
// not given, it is activated for all nodes.

// :: ?number #path=DOMParseSpec.rank
// The precedence of this parsing strategy. Should be a number between
// 0 and 100, which determines when this parser gets a chance relative
// to others that apply to the node (low ranks go first). Defaults to
// 50.

// :: union<string, (dom: DOMNode, state: DOMParseState) → ?bool> #path=DOMParseSpec.parse
// The function that, given a DOM node, parses it, updating the parse
// state. It should return (the exact value) `false` when it wants to
// indicate that it was not able to parse this node. This function is
// called in such a way that `this` is bound to the type that the
// parse spec was associated with.
//
// When this is set to the string `"block"`, the content of the DOM
// node is parsed as the content in a node of the type that this spec
// was associated with.
//
// When set to the string `"mark"`, the content of the DOM node is
// parsed with an instance of the mark that this spec was associated
// with added to their marks.

defineSource("dom", fromDOM)

// :: (Schema, string, ?Object) → Node
// Parses the HTML into a DOM, and then calls through to `fromDOM`.
export function fromHTML(schema, html, options) {
  let wrap = (options && options.document || window.document).createElement("div")
  wrap.innerHTML = html
  return fromDOM(schema, wrap, options)
}

defineSource("html", fromHTML)

const blockElements = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
}

const noMarks = []

// ;; A state object used to track context during a parse, and to
// expose methods to custom parsing functions.
class DOMParseState {
  constructor(schema, topNode, options) {
    // :: Object The options passed to this parse.
    this.options = options || {}
    // :: Schema The schema that we are parsing into.
    this.schema = schema
    this.stack = []
    this.marks = noMarks
    this.closing = false
    this.enter(topNode.type, topNode.attrs)
    this.nodeInfo = nodeInfo(schema)
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  parseAttrs(dom, type, attrs) {
    for (let attr in type.attrs) {
      let desc = type.attrs[attr]
      if (desc.parseDOM && (!attrs || !Object.prototype.hasOwnProperty.call(attrs, attr))) {
        let value = desc.parseDOM(dom, this.options, desc, type)
        if (value != null) {
          if (!attrs) attrs = {}
          attrs[attr] = value
        }
      }
    }
    return attrs
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      // FIXME define a coherent strategy for dealing with trailing, leading, and multiple spaces (this isn't one)
      let value = dom.nodeValue
      let top = this.top, last
      if (/\S/.test(value) || top.type.isTextblock) {
        value = value.replace(/\s+/g, " ")
        if (/^\s/.test(value) && (last = top.content[top.content.length - 1]) &&
            last.type.name == "text" && /\s$/.test(last.text))
          value = value.slice(1)
        if (value)
          this.insert(this.schema.text(value, this.marks))
      }
    } else if (dom.nodeType != 1 || dom.hasAttribute("pm-ignore")) {
      // Ignore non-text non-element nodes
    } else if (!this.parseNodeType(dom)) {
      this.addAll(dom.firstChild, null)
      let name = dom.nodeName.toLowerCase()
      if (blockElements.hasOwnProperty(name) && this.top.type == this.schema.defaultTextblockType())
        this.closing = true
    }
  }

  tryParsers(parsers, dom) {
    if (parsers) for (let i = 0; i < parsers.length; i++) {
      let parser = parsers[i]
      if (parser.parse.call(parser.type, dom, this) !== false) return true
    }
  }

  parseNodeType(dom) {
    return this.tryParsers(this.nodeInfo[dom.nodeName.toLowerCase()], dom) ||
      this.tryParsers(this.nodeInfo._, dom)
  }

  addAll(from, to, sync) {
    let stack = sync && this.stack.slice()
    for (let dom = from; dom != to; dom = dom.nextSibling) {
      this.addDOM(dom)
      if (sync && blockElements.hasOwnProperty(dom.nodeName.toLowerCase()))
        this.sync(stack)
    }
  }

  doClose() {
    if (!this.closing || this.stack.length < 2) return
    let left = this.leave()
    this.enter(left.type, left.attrs)
    this.closing = false
  }

  insert(node) {
    if (this.top.type.canContain(node)) {
      this.doClose()
    } else {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        let route = this.stack[i].type.findConnection(node.type)
        if (!route) continue
        if (i == this.stack.length - 1) {
          this.doClose()
        } else {
          while (this.stack.length > i + 1) this.leave()
        }
        for (let j = 0; j < route.length; j++)
          this.enter(route[j])
        if (this.marks.length) this.marks = noMarks
        break
      }
    }
    this.top.content.push(node)
    return node
  }

  // :: (DOMNode, NodeType, ?Object, [Node]) → Node
  // Insert a node of the given type, with the given content, based on
  // `dom`, at the current position in the document.
  insertFrom(dom, type, attrs, content) {
    return this.insert(type.createAutoFill(this.parseAttrs(dom, type, attrs), content, this.marks))
  }

  enter(type, attrs) {
    if (this.marks.length) this.marks = noMarks
    this.stack.push({type, attrs, content: []})
  }

  enterFrom(dom, type, attrs) {
    this.enter(type, this.parseAttrs(dom, type, attrs))
  }

  leave() {
    let top = this.stack.pop()
    let node = top.type.createAutoFill(top.attrs, top.content)
    if (this.stack.length) this.insert(node)
    return node
  }

  sync(stack) {
    while (this.stack.length > stack.length) this.leave()
    for (;;) {
      let n = this.stack.length - 1, one = this.stack[n], two = stack[n]
      if (one.type == two.type && Node.sameAttrs(one.attrs, two.attrs)) break
      this.leave()
    }
    while (stack.length > this.stack.length) {
      let add = stack[this.stack.length]
      this.enter(add.type, add.attrs)
    }
    if (this.marks.length) this.marks = noMarks
    this.closing = false
  }

  // :: (DOMNode, NodeType, ?Object)
  // Parse the contents of `dom` as children of a node of the given
  // type.
  wrapIn(dom, type, attrs) {
    this.enterFrom(dom, type, attrs)
    this.addAll(dom.firstChild, null, true)
    this.leave()
  }

  // :: (DOMNode, Mark)
  // Parse the contents of `dom`, with `mark` added to the set of
  // current marks.
  wrapMark(dom, mark) {
    let old = this.marks
    this.marks = (mark.instance || mark).addToSet(old)
    this.addAll(dom.firstChild, null)
    this.marks = old
  }
}

function nodeInfo(schema) {
  return schema.cached.parseDOMNodes || (schema.cached.parseDOMNodes = summarizeNodeInfo(schema))
}

function summarizeNodeInfo(schema) {
  let tags = Object.create(null)
  tags._ = []
  function read(type) {
    let info = type.parseDOM
    if (!info) return
    info.forEach(info => {
      let tag = info.tag || "_"
      let parse = info.parse
      if (parse == "block")
        parse = function(dom, state) { state.wrapIn(dom, this) }
      else if (parse == "mark")
        parse = function(dom, state) { state.wrapMark(dom, this) }
      ;(tags[tag] || (tags[tag] = [])).push({
        type, parse,
        rank: info.rank == null ? 50 : info.rank
      })
    })
  }

  for (let name in schema.nodes) read(schema.nodes[name])
  for (let name in schema.marks) read(schema.marks[name])
  for (let tag in tags) tags[tag].sort((a, b) => a.rank - b.rank)
  return tags
}

Paragraph.register("parseDOM", {tag: "p", parse: "block"})

BlockQuote.register("parseDOM", {tag: "blockquote", parse: "block"})

for (let i = 1; i <= 6; i++)
  Heading.register("parseDOM", {
    tag: "h" + i,
    parse: function(dom, state) { state.wrapIn(dom, this, {level: i}) }
  })

HorizontalRule.register("parseDOM", {tag: "hr", parse: "block"})

CodeBlock.register("parseDOM", {tag: "pre", parse: function(dom, state) {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  let text = dom.textContent
  state.insertFrom(dom, this, {params}, text ? [state.schema.text(text)] : [])
}})

BulletList.register("parseDOM", {tag: "ul", parse: "block"})

OrderedList.register("parseDOM", {tag: "ol", parse: function(dom, state) {
  let attrs = {order: dom.getAttribute("start") || 1}
  state.wrapIn(dom, this, attrs)
}})

ListItem.register("parseDOM", {tag: "li", parse: "block"})

HardBreak.register("parseDOM", {tag: "br", parse: function(dom, state) {
  state.insertFrom(dom, this)
}})

Image.register("parseDOM", {tag: "img", parse: function(dom, state) {
  state.insertFrom(dom, this, {
    src: dom.getAttribute("src"),
    title: dom.getAttribute("title") || null,
    alt: dom.getAttribute("alt") || null
  })
}})

// Inline style tokens

LinkMark.register("parseDOM", {tag: "a", parse: function(dom, state) {
  let href = dom.getAttribute("href")
  if (!href) return false
  state.wrapMark(dom, this.create({href, title: dom.getAttribute("title")}))
}})

EmMark.register("parseDOM", {tag: "i", parse: "mark"})
EmMark.register("parseDOM", {tag: "em", parse: "mark"})

StrongMark.register("parseDOM", {tag: "b", parse: "mark"})
StrongMark.register("parseDOM", {tag: "strong", parse: "mark"})

CodeMark.register("parseDOM", {tag: "code", parse: "mark"})

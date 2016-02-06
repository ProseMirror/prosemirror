import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark, Node} from "../model"
import sortedInsert from "../util/sortedinsert"
import {defineSource} from "./register"

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

const ignoreElements = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
}

const noMarks = []

// ;; A state object used to track context during a parse,
// and to expose methods to custom parsing functions.
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
    let info = schemaInfo(schema)
    this.tagInfo = info.tags
    this.styleInfo = info.styles
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      let value = dom.nodeValue
      let top = this.top, last
      if (/\S/.test(value) || top.type.isTextblock) {
        value = value.replace(/\s+/g, " ")
        // If this starts with whitespace, and there is either no node
        // before it or a node that ends with whitespace, strip the
        // leading space.
        if (/^\s/.test(value) &&
            (!(last = top.content[top.content.length - 1]) ||
             (last.type.name == "text" && /\s$/.test(last.text))))
          value = value.slice(1)
        if (value)
          this.insertNode(this.schema.text(value, this.marks))
      }
    } else if (dom.nodeType != 1 || dom.hasAttribute("pm-ignore")) {
      // Ignore non-text non-element nodes
    } else {
      let style = dom.getAttribute("style")
      if (style) this.addElementWithStyles(parseStyles(style), dom)
      else this.addElement(dom)
    }
  }

  addElement(dom) {
    let name = dom.nodeName.toLowerCase()
    if (!this.parseNodeType(name, dom) && !ignoreElements.hasOwnProperty(name)) {
      this.addAll(dom.firstChild, null)
      if (blockElements.hasOwnProperty(name) && this.top.type == this.schema.defaultTextblockType())
        this.closing = true
    }
  }

  addElementWithStyles(styles, dom) {
    let wrappers = []
    for (let i = 0; i < styles.length; i += 2) {
      let parsers = this.styleInfo[styles[i]], value = styles[i + 1]
      if (parsers) for (let j = 0; j < parsers.length; j++)
        wrappers.push(parsers[j], value)
    }
    let next = (i) => {
      if (i == wrappers.length) {
        this.addElement(dom)
      } else {
        let parser = wrappers[i]
        parser.parse.call(parser.type, wrappers[i + 1], this, next.bind(null, i + 2))
      }
    }
    next(0)
  }

  tryParsers(parsers, dom) {
    if (parsers) for (let i = 0; i < parsers.length; i++) {
      let parser = parsers[i]
      if (parser.parse.call(parser.type, dom, this) !== false) return true
    }
  }

  parseNodeType(name, dom) {
    return this.tryParsers(this.tagInfo[name], dom) ||
      this.tryParsers(this.tagInfo._, dom)
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

  insertNode(node) {
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
  insert(type, attrs, content) {
    return this.insertNode(type.createAutoFill(attrs, content, this.marks))
  }

  enter(type, attrs) {
    this.stack.push({type, attrs, content: []})
  }

  leave() {
    if (this.marks.length) this.marks = noMarks
    let top = this.stack.pop()
    let last = top.content[top.content.length - 1]
    if (last && last.isText && /\s$/.test(last.text))
      top.content[top.content.length - 1] = last.copy(last.text.slice(0, last.text.length - 1))
    let node = top.type.createAutoFill(top.attrs, top.content)
    if (this.stack.length) this.insertNode(node)
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
    this.enter(type, attrs)
    this.addAll(dom.firstChild, null, true)
    this.leave()
  }

  // :: (DOMNode, Mark)
  // Parse the contents of `dom`, with `mark` added to the set of
  // current marks.
  wrapMark(inner, mark) {
    let old = this.marks
    this.marks = (mark.instance || mark).addToSet(old)
    if (inner.call) inner()
    else this.addAll(inner.firstChild, null)
    this.marks = old
  }
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
    if (parse == "block")
      parse = function(dom, state) { state.wrapIn(dom, this) }
    else if (parse == "mark")
      parse = function(dom, state) { state.wrapMark(dom, this) }
    sortedInsert(tags[tag] || (tags[tag] = []), {
      type, parse,
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

Paragraph.register("parseDOM", "p", {parse: "block"})

BlockQuote.register("parseDOM", "blockquote", {parse: "block"})

for (let i = 1; i <= 6; i++) Heading.registerComputed("parseDOM", "h" + i, type => {
  if (i <= type.maxLevel) return {
    parse: function(dom, state) { state.wrapIn(dom, this, {level: i}) }
  }
})

HorizontalRule.register("parseDOM", "hr", {parse: "block"})

CodeBlock.register("parseDOM", "pre", {parse: function(dom, state) {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  let text = dom.textContent
  state.insert(this, {params}, text ? [state.schema.text(text)] : [])
}})

BulletList.register("parseDOM", "ul", {parse: "block"})

OrderedList.register("parseDOM", "ol", {parse: function(dom, state) {
  let attrs = {order: dom.getAttribute("start") || 1}
  state.wrapIn(dom, this, attrs)
}})

ListItem.register("parseDOM", "li", {parse: "block"})

HardBreak.register("parseDOM", "br", {parse: function(_, state) {
  state.insert(this)
}})

Image.register("parseDOM", "img", {parse: function(dom, state) {
  state.insert(this, {
    src: dom.getAttribute("src"),
    title: dom.getAttribute("title") || null,
    alt: dom.getAttribute("alt") || null
  })
}})

// Inline style tokens

LinkMark.register("parseDOM", "a", {parse: function(dom, state) {
  let href = dom.getAttribute("href")
  if (!href) return false
  state.wrapMark(dom, this.create({href, title: dom.getAttribute("title")}))
}})

EmMark.register("parseDOM", "i", {parse: "mark"})
EmMark.register("parseDOM", "em", {parse: "mark"})
StrongMark.register("parseDOMStyle", "font-style", {parse: function(value, state, inner) {
  if (value == "italic") state.wrapMark(inner, this)
  else inner()
}})

StrongMark.register("parseDOM", "b", {parse: "mark"})
StrongMark.register("parseDOM", "strong", {parse: "mark"})
StrongMark.register("parseDOMStyle", "font-weight", {parse: function(value, state, inner) {
  if (value == "bold" || value == "bolder" || !/\D/.test(value) && +value >= 500) state.wrapMark(inner, this)
  else inner()
}})

CodeMark.register("parseDOM", "code", {parse: "mark"})

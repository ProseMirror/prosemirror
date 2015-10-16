import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle,
        compareMarkup, Pos, defaultSchema} from "../model"
import {defineSource} from "./index"

export function fromDOM(schema, dom, options) {
  if (!options) options = {}
  let context = new Context(schema, options.topNode || schema.node("doc"))
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end, true)
  let doc
  while (context.stack.length) doc = context.leave()
  if (!Pos.start(doc)) doc = doc.splice(0, 0, [schema.node("paragraph")])
  return doc
}

defineSource("dom", fromDOM)

export function fromHTML(schema, html, options) {
  let wrap = options.document.createElement("div")
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

class Context {
  constructor(schema, topNode) {
    this.schema = schema
    this.stack = []
    this.styles = []
    this.closing = false
    this.enter(topNode.type, topNode.attrs)
    this.nodeInfo = nodeInfo(schema)
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      let value = dom.nodeValue
      let top = this.top, block = top.isTextblock, last
      if (/\S/.test(value) || block) {
        value = value.replace(/\s+/g, " ")
        if (/^\s/.test(value) && (last = top.content[top.content.length - 1]) &&
            last.type.name == "text" && /\s$/.test(last.text))
          value = value.slice(1)
        this.insert(this.schema.text(value, this.styles))
      }
    } else if (dom.nodeType != 1) {
      // Ignore non-text non-element nodes
    } else if (dom.hasAttribute("pm-html")) {
      let type = dom.getAttribute("pm-html")
      if (type == "html_tag")
        this.insert(this.schema.node("html_tag", {html: dom.innerHTML}, null, this.styles))
      else
        this.insert(this.schema.node("html_block", {html: dom.innerHTML}))
    } else if (!this.parseNodeType(dom)) {
      this.addAll(dom.firstChild, null)
      let name = dom.nodeName.toLowerCase()
      if (blockElements.hasOwnProperty(name) && this.top.type == this.schema.nodeTypes.paragraph)
        this.closing = true
    }
  }

  tryParsers(parsers, dom) {
    if (parsers) for (let i = 0; i < parsers.length; i++) {
      let parser = parsers[i]
      if (parser.parse(dom, this, parser.type) !== false) return true
    }
  }

  parseNodeType(dom) {
    return this.tryParsers(this.nodeInfo[dom.nodeName.toLowerCase()], dom)
      || this.tryParsers(this.nodeInfo._, dom)
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
    if (this.top.type.canContain(node.type)) {
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
        if (this.styles.length) this.styles = []
        break
      }
    }
    this.top.content.push(node)
  }

  enter(type, attrs) {
    if (this.styles.length) this.styles = []
    this.stack.push({type: type, attrs: attrs, content: []})
  }

  leave() {
    let top = this.stack.pop()
    let node = this.schema.node(top.type, top.attrs, top.content)
    if (this.stack.length) this.insert(node)
    return node
  }

  sync(stack) {
    while (this.stack.length > stack.length) this.leave()
    for (;;) {
      let n = this.stack.length - 1, one = this.stack[n], two = stack[n]
      if (compareMarkup(one.type, two.type, one.attrs, two.attrs)) break
      this.leave()
    }
    while (stack.length > this.stack.length) {
      let add = stack[this.stack.length]
      this.enter(add.type, add.attrs)
    }
    if (this.styles.length) this.styles = []
    this.closing = false
  }
}

function nodeInfo(schema) {
  return schema.cached.parseDOMNodes || (schema.cached.parseDOMNodes = summarizeNodeInfo(schema))
}

function summarizeNodeInfo(schema) {
  let tags = Object.create(null)
  tags._ = []
  function read(value) {
    let info = value.parseFromDOM
    if (!info) return
    ;(Array.isArray(info) ? info : [info]).forEach(info => {
      let tag = info.tag || "_"
      ;(tags[tag] || (tags[tag] = [])).push({
        type: value,
        rank: info.rank == null ? 50 : info.rank,
        parse: info.parse
      })
    })
  }

  for (let name in schema.nodeTypes) read(schema.nodeTypes[name])
  for (let name in schema.styles) read(schema.styles[name])
  for (let tag in tags) tags[tag].sort((a, b) => a.rank - b.rank)
  return tags
}

function wrap(dom, context, type, attrs) {
  context.enter(type, attrs)
  context.addAll(dom.firstChild, null, true)
  context.leave()
}

function def(type, tag, parse, rank) {
  ;(type.prototype.parseFromDOM || (type.prototype.parseFromDOM = [])).push({tag, parse, rank})
}

def(Paragraph, "p", wrap)

def(BlockQuote, "blockquote", wrap)

for (let i = 1; i <= 6; i++)
  def(Heading, "h" + i, (dom, context, type) => wrap(dom, context, type, {level: i}))

def(HorizontalRule, "hr", wrap)

def(CodeBlock, "pre", (dom, context, type) => {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  context.insert(context.schema.node(type, {params: params}, [context.schema.text(dom.textContent)]))
})

def(BulletList, "ul", wrap)

def(OrderedList, "ol", (dom, context, type) => {
  let attrs = {order: dom.getAttribute("start") || 1}
  wrap(dom, context, type, attrs)
})

def(ListItem, "li", wrap)

def(HardBreak, "br", (dom, context, type) => {
  if (!dom.hasAttribute("pm-force-br"))
    context.insert(context.schema.node(type, null, null, context.styles))
})

def(Image, "img", (dom, context, type) => {
  let attrs = {src: dom.getAttribute("src"),
               title: dom.getAttribute("title") || null,
               alt: dom.getAttribute("alt") || null}
  context.insert(context.schema.node(type, attrs))
})

// Inline style tokens

function inline(dom, context, style) {
  var old = context.styles
  context.styles = (style.instance || style).addToSet(old)
  context.addAll(dom.firstChild, null)
  context.styles = old
}

def(LinkStyle, "a", (dom, context, style) => {
  inline(dom, context, style.create({
    href: dom.getAttribute("href"),
    title: dom.getAttribute("title")
  }))
})

def(StrongStyle, "b", inline)
def(StrongStyle, "strong", inline)

def(EmStyle, "i", inline)
def(EmStyle, "em", inline)

def(CodeStyle, "code", inline)

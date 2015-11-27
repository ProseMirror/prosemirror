import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle,
        compareMarkup} from "../model"
import {defineSource} from "./index"

export function fromDOM(schema, dom, options) {
  if (!options) options = {}
  let context = new Context(schema, options.topNode || schema.node("doc"))
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end, true)
  let doc
  while (context.stack.length) doc = context.leave()
  return doc
}

defineSource("dom", fromDOM)

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
          this.insert(this.schema.text(value, this.styles))
      }
    } else if (dom.nodeType != 1) {
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
      if (parser.parse(dom, this, parser.type, null, this.options) !== false) return true
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
        if (this.styles.length) this.styles = []
        break
      }
    }
    this.top.content.push(node)
    return node
  }

  insertFrom(dom, type, attrs, content, styles) {
    return this.insert(type.createAutoFill(this.parseAttrs(dom, type, attrs), content, styles))
  }

  enter(type, attrs) {
    if (this.styles.length) this.styles = []
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
    let info = value.parseDOM
    if (!info) return
    info.forEach(info => {
      let tag = info.tag || "_"
      ;(tags[tag] || (tags[tag] = [])).push({
        type: value,
        rank: info.rank == null ? 50 : info.rank,
        parse: info.parse
      })
    })
  }

  for (let name in schema.nodes) read(schema.nodes[name])
  for (let name in schema.styles) read(schema.styles[name])
  for (let tag in tags) tags[tag].sort((a, b) => a.rank - b.rank)
  return tags
}

function wrap(dom, context, type, attrs) {
  context.enterFrom(dom, type, attrs)
  context.addAll(dom.firstChild, null, true)
  context.leave()
}

Paragraph.register("parseDOM", {tag: "p", parse: wrap})

BlockQuote.register("parseDOM", {tag: "blockquote", parse: wrap})

for (let i = 1; i <= 6; i++)
  Heading.register("parseDOM", {
    tag: "h" + i,
    parse: (dom, context, type) => wrap(dom, context, type, {level: i})
  })

HorizontalRule.register("parseDOM", {tag: "hr", parse: wrap})

CodeBlock.register("parseDOM", {tag: "pre", parse: (dom, context, type) => {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  let text = dom.textContent
  context.insertFrom(dom, type, {params}, text ? [context.schema.text(text)] : [])
}})

BulletList.register("parseDOM", {tag: "ul", parse: wrap})

OrderedList.register("parseDOM", {tag: "ol", parse: (dom, context, type) => {
  let attrs = {order: dom.getAttribute("start") || 1}
  wrap(dom, context, type, attrs)
}})

ListItem.register("parseDOM", {tag: "li", parse: wrap})

HardBreak.register("parseDOM", {tag: "br", parse: (dom, context, type) => {
  if (!dom.hasAttribute("pm-force-br"))
    context.insertFrom(dom, type, null, null, context.styles)
}})

Image.register("parseDOM", {tag: "img", parse: (dom, context, type) => {
  context.insertFrom(dom, type, {
    src: dom.getAttribute("src"),
    title: dom.getAttribute("title") || null,
    alt: dom.getAttribute("alt") || null
  })
}})

// Inline style tokens

function inline(dom, context, style) {
  var old = context.styles
  context.styles = (style.instance || style).addToSet(old)
  context.addAll(dom.firstChild, null)
  context.styles = old
}

LinkStyle.register("parseDOM", {tag: "a", parse: (dom, context, style) => {
  let href = dom.getAttribute("href")
  if (!href) return false
  inline(dom, context, style.create({href, title: dom.getAttribute("title")}))
}})

EmStyle.register("parseDOM", {tag: "i", parse: inline})
EmStyle.register("parseDOM", {tag: "em", parse: inline})

StrongStyle.register("parseDOM", {tag: "b", parse: inline})
StrongStyle.register("parseDOM", {tag: "strong", parse: inline})

CodeStyle.register("parseDOM", {tag: "code", parse: inline})

import {style, Node, Span, nodeTypes, findConnection} from "../model"
import {defineSource} from "./convert"

export function fromDOM(dom, options) {
  if (!options) options = {}
  let context = new Context(options.topNode || new Node("doc"))
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end, true)
  return context.stack[0]
}

defineSource("dom", fromDOM)

const blockElements = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
}

class Context {
  constructor(topNode) {
    this.stack = [topNode]
    this.styles = []
    this.closing = false
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      let value = dom.nodeValue
      let top = this.top, block = top.type.block
      if (/\S/.test(value) || block) {
        value = value.replace(/\s+/g, " ")
        if (/^\s/.test(value) && top.content.length && /\s$/.test(top.content[top.content.length - 1].text))
          value = value.slice(1)
        this.insert(Span.text(value, this.styles))
      }
    } else if (dom.nodeType != 1) {
      // Ignore non-text non-element nodes
    } else if (dom.hasAttribute("pm-html")) {
      let type = dom.getAttribute("pm-html")
      if (type == "html_tag")
        this.insert(new Span("html_tag", {html: dom.innerHTML}, this.styles))
      else
        this.insert(new Node("html_block", {html: dom.innerHTML}))
    } else {
      let name = dom.nodeName.toLowerCase()
      if (name in tags) {
        tags[name](dom, this)
      } else {
        this.addAll(dom.firstChild, null)
        if (blockElements.hasOwnProperty(name) && this.top.type == nodeTypes.paragraph)
          this.closing = true
      }
    }
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
    if (!this.closing) return
    let left = this.stack.pop().copy()
    this.top.push(left)
    this.stack.push(left)
    this.closing = false
  }

  insert(node) {
    if (this.top.type.contains == node.type.type) {
      this.doClose()
    } else {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        let route = findConnection(this.stack[i].type, node.type)
        if (!route) continue
        if (i == this.stack.length - 1)
          this.doClose()
        else
          this.stack.length = i + 1
        for (let j = 0; j < route.length; j++) {
          let wrap = new Node(route[j])
          this.top.push(wrap)
          this.stack.push(wrap)
        }
        if (this.styles.length) this.styles = []
        break
      }
    }
    this.top.push(node)
  }

  enter(node) {
    this.insert(node)
    if (this.styles.length) this.styles = []
    this.stack.push(node)
  }

  sync(stack) {
    while (this.stack.length > stack.length) this.stack.pop()
    while (!stack[this.stack.length - 1].sameMarkup(stack[this.stack.length - 1])) this.stack.pop()
    while (stack.length > this.stack.length) {
      let add = stack[this.stack.length].copy()
      this.top.push(add)
      this.stack.push(add)
    }
    if (this.styles.length) this.styles = []
    this.closing = false
  }
}

const tags = Object.create(null)

function wrap(dom, context, node) {
  context.enter(node)
  context.addAll(dom.firstChild, null, true)
  context.stack.pop()
}

function wrapAs(type) {
  return (dom, context) => wrap(dom, context, new Node(type))
}

function inline(dom, context, added) {
  var old = context.styles
  context.styles = style.add(old, added)
  context.addAll(dom.firstChild, null)
  context.styles = old
}

tags.p = wrapAs("paragraph")

tags.blockquote = wrapAs("blockquote")

for (var i = 1; i <= 6; i++) {
  let attrs = {level: i}
  tags["h" + i] = (dom, context) => wrap(dom, context, new Node("heading", attrs))
}

tags.hr = (_, context) => context.insert(new Node("horizontal_rule"))

tags.pre = (dom, context) => {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  context.insert(new Node("code_block", {params: params}, [Span.text(dom.textContent)]))
}

tags.ul = (dom, context) => {
  let cls = dom.getAttribute("class")
  let attrs = {bullet: /bullet_dash/.test(cls) ? "-" : /bullet_plus/.test(cls) ? "+" : "*",
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, new Node("bullet_list", attrs))
}

tags.ol = (dom, context) => {
  let attrs = {order: dom.getAttribute("start") || 1,
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, new Node("ordered_list", attrs))
}

tags.li = wrapAs("list_item")

tags.br = (dom, context) => {
  if (!dom.hasAttribute("pm-force-br"))
    context.insert(new Span("hard_break", null, context.styles))
}

tags.a = (dom, context) => inline(dom, context, style.link(dom.getAttribute("href"), dom.getAttribute("title")))

tags.b = tags.strong = (dom, context) => inline(dom, context, style.strong)

tags.i = tags.em = (dom, context) => inline(dom, context, style.em)

tags.code = (dom, context) => inline(dom, context, style.code)

tags.img = (dom, context) => {
  let attrs = {src: dom.getAttribute("src"),
               title: dom.getAttribute("title") || null,
               alt: dom.getAttribute("alt") || null}
  context.insert(new Span("image", attrs))
}

import {style, $node, $text, Node, Pos, nodeTypes, findConnection} from "../model"
import {defineSource} from "./index"

export function fromDOM(dom, options) {
  if (!options) options = {}
  let context = new Context(options.topNode || $node("doc"))
  let start = options.from ? dom.childNodes[options.from] : dom.firstChild
  let end = options.to != null && dom.childNodes[options.to] || null
  context.addAll(start, end, true)
  let doc
  while (context.stack.length) doc = context.leave()
  if (!Pos.start(doc)) doc = doc.splice(0, 0, [$node("paragraph")])
  return doc
}

defineSource("dom", fromDOM)

export function fromHTML(html, options) {
  let wrap = options.document.createElement("div")
  wrap.innerHTML = html
  return fromDOM(wrap, options)
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
  constructor(topNode) {
    this.stack = []
    this.styles = []
    this.closing = false
    this.enter(topNode.type, topNode.attrs)
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      let value = dom.nodeValue
      let top = this.top, block = top.type.block, last
      if (/\S/.test(value) || block) {
        value = value.replace(/\s+/g, " ")
        if (/^\s/.test(value) && (last = top.content[top.content.length - 1]) &&
            last.type.name == "text" && /\s$/.test(last.text))
          value = value.slice(1)
        this.insert($text(value, this.styles))
      }
    } else if (dom.nodeType != 1) {
      // Ignore non-text non-element nodes
    } else if (dom.hasAttribute("pm-html")) {
      let type = dom.getAttribute("pm-html")
      if (type == "html_tag")
        this.insert($node("html_tag", {html: dom.innerHTML}, null, this.styles))
      else
        this.insert($node("html_block", {html: dom.innerHTML}))
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
    if (!this.closing || this.stack.length < 2) return
    let left = this.leave()
    this.enter(left.type, left.attrs)
    this.closing = false
  }

  insert(node) {
    if (this.top.type.contains == node.type.type) {
      this.doClose()
    } else {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        let route = findConnection(this.stack[i].type, node.type)
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
    let node = $node(top.type, top.attrs, top.content)
    if (this.stack.length) this.insert(node)
    return node
  }

  sync(stack) {
    while (this.stack.length > stack.length) this.leave()
    for (;;) {
      let n = this.stack.length - 1, one = this.stack[n], two = stack[n]
      if (Node.compareMarkup(one.type, two.type, one.attrs, two.attrs)) break
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

// FIXME don't export, define proper extension mechanism
export const tags = Object.create(null)

function wrap(dom, context, type, attrs) {
  context.enter(nodeTypes[type], attrs)
  context.addAll(dom.firstChild, null, true)
  context.leave()
}

function wrapAs(type) {
  return (dom, context) => wrap(dom, context, type)
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
  tags["h" + i] = (dom, context) => wrap(dom, context, "heading", attrs)
}

tags.hr = (_, context) => context.insert($node("horizontal_rule"))

tags.pre = (dom, context) => {
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class")
  if (params && /fence/.test(params)) {
    let found = [], re = /(?:^|\s)lang-(\S+)/g, m
    while (m = re.test(params)) found.push(m[1])
    params = found.join(" ")
  } else {
    params = null
  }
  context.insert($node("code_block", {params: params}, [$text(dom.textContent)]))
}

tags.ul = (dom, context) => {
  let cls = dom.getAttribute("class")
  let attrs = {bullet: /bullet_dash/.test(cls) ? "-" : /bullet_plus/.test(cls) ? "+" : "*",
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, "bullet_list", attrs)
}

tags.ol = (dom, context) => {
  let attrs = {order: dom.getAttribute("start") || 1,
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, "ordered_list", attrs)
}

tags.li = wrapAs("list_item")

tags.br = (dom, context) => {
  if (!dom.hasAttribute("pm-force-br"))
    context.insert($node("hard_break", null, null, context.styles))
}

tags.a = (dom, context) => inline(dom, context, style.link(dom.getAttribute("href"), dom.getAttribute("title")))

tags.b = tags.strong = (dom, context) => inline(dom, context, style.strong)

tags.i = tags.em = (dom, context) => inline(dom, context, style.em)

tags.code = (dom, context) => inline(dom, context, style.code)

tags.img = (dom, context) => {
  let attrs = {src: dom.getAttribute("src"),
               title: dom.getAttribute("title") || null,
               alt: dom.getAttribute("alt") || null}
  context.insert($node("image", attrs))
}

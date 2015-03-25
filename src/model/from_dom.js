import Node from "./node"
import * as style from "./style"

export default function fromDOM(dom, options) {
  if (!options) options = {}
  let context = new Context(options.topNode || new Node("doc"))
  context.addContent(dom, options.from || 0, options.to != null ? options.to : dom.childNodes.length)
  return context.stack[0]
}

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
    this.frames = []
    this.styles = []
    this.closing = false
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      this.insert(Node.text(dom.nodeValue, this.styles))
    } else if (dom.nodeType != 1) {
      // Ignore non-text non-element nodes
    } else if (dom.hasAttribute("pm-html")) {
      let type = dom.getAttribute("pm-html")
      if (type == "html_tag")
        this.insert(new Node.Inline("html_tag", this.styles, null, {html: dom.innerHTML}))
      else
        this.insert(new Node("html_block", null, {html: dom.innerHTML}))
    } else {
      let name = dom.nodeName.toLowerCase()
      if (name in tags) {
        tags[name](dom, this)
      } else {
        this.addContent(dom)
        if (blockElements.hasOwnProperty(name) && this.top.type == Node.types.paragraph)
          this.closing = true
      }
    }
  }

  addContent(dom, start = 0, end = dom.childNodes.length) {
    for (let i = start; i < end; i++)
      this.addDOM(dom.childNodes[i])
  }

  insert(node) {
    if (this.closing) {
      let left = this.stack.pop().copy()
      this.top.push(left)
      this.stack.push(left)
      this.closing = false
    }
    let top = this.stack[this.stack.length - 1]
    if (top.type.contains == node.type.type) {
      top.push(node)
    } else {
      let route = Node.findConnection(top.type, node.type)
      if (!route) return false
      for (let i = 0; i < route.length; i++)
        this.enter(new Node(route[i]), false)
      this.top.push(node)
    }
    return true
  }

  enter(node, isFrame) {
    // FIXME is it really okay to discard what we can't place?
    if (!this.insert(node)) return false
    if (this.styles.length) this.styles = []
    if (isFrame !== false)
      this.frames.push(this.stack.length)
    this.stack.push(node)
    return true
  }

  leave() {
    this.stack.length = this.frames.pop()
    this.closing = false
  }
}

const tags = Object.create(null)

function wrap(dom, context, node) {
  if (context.enter(node)) {
    context.addContent(dom)
    context.leave()
  }
}

function wrapAs(type) {
  return (dom, context) => wrap(dom, context, new Node(type))
}

function inline(dom, context, added) {
  var old = context.styles
  context.styles = style.add(old, added)
  context.addContent(dom)
  context.styles = old
}

tags.p = wrapAs("paragraph")

tags.blockquote = wrapAs("blockquote")

for (var i = 1; i <= 6; i++) (function(attrs) {
  tags["h" + i] = (dom, context) => wrap(dom, context, new Node("heading", null, attrs))
})({level: i})

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
  context.insert(new Node("code_block", [Node.text(dom.textContent)], {params: params}))
}

tags.ul = (dom, context) => {
  let cls = dom.getAttribute("class")
  let attrs = {bullet: /bullet_dash/.test(cls) ? "-" : /bullet_plus/.test(cls) ? "+" : "*",
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, new Node("bullet_list", null, attrs))
}

tags.ol = (dom, context) => {
  let attrs = {order: dom.getAttribute("start") || 1,
               tight: /\btight\b/.test(dom.getAttribute("class"))}
  wrap(dom, context, new Node("ordered_list", null, attrs))
}

tags.li = wrapAs("list_item")

tags.br = (_, context) => context.insert(new Node.Inline("hard_break", context.styles))

tags.a = (dom, context) => inline(dom, context, style.link(dom.getAttribute("href"), dom.getAttribute("title")))

tags.b = tags.strong = (dom, context) => inline(dom, context, style.strong)

tags.i = tags.em = (dom, context) => inline(dom, context, style.em)

tags.code = (dom, context) => inline(dom, context, style.code)

tags.img = (dom, context) => {
  let attrs = {src: dom.getAttribute("src"),
               title: dom.getAttribute("title") || null,
               alt: dom.getAttribute("alt") || null}
  context.insert(new Node.Inline("image", null, attrs))
}

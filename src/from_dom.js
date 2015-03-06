import Node from "./node"
import * as style from "./style"

export default function fromDOM(dom) {
  let context = new Context;
  context.addContent(dom)
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
  constructor() {
    this.stack = [new Node("doc")]
    this.frames = []
    this.styles = []
  }

  get top() {
    return this.stack[this.stack.length - 1]
  }

  addDOM(dom) {
    if (dom.nodeType == 3) {
      this.insert(new Node.Inline("text", this.styles, dom.nodeValue))
    } else if (dom.hasAttribute("mm-html")) {
      let type = dom.getAttribute("mm-html")
      if (type == "html_tag")
        this.insert(new Node.Inline("html_tag", this.styles, null, {html: dom.innerHTML}))
      else
        this.insert(new Node("html_block", null, {html: dom.innerHTML}))
    } else {
      let name = dom.nodeName.toLowerCase()
      if (name in tags) {
        tags[name](dom, this)
      } else {
        let asPara = blockElements.hasOwnProperty(name) && this.top.type.contains == "block"
        if (asPara) this.enter(new Node("paragraph"))
        this.addContent(dom)
        if (asPara) this.leave()
      }
    }
  }

  addContent(dom) {
    for (let child = dom.firstChild; child; child = child.nextSibling)
      this.addDOM(child)
  }

  insert(node) {
    let top = this.stack[this.stack.length - 1]
    if (top.type.contains == node.type.type) {
      top.push(node)
    } else {
      let route = findRoute(top.type, node.type)
      if (!route) return false
      for (let i = 0; i < route.length; i++)
        this.enter(new Node(route[i], null, Node.types[route[i]].defaultAttrs), false)
      this.top.push(node)
    }
    return true
  }

  enter(node, isFrame) {
    if (!this.insert(node)) return false
    if (this.styles.length) this.styles = []
    if (isFrame !== false)
      this.frames.push(this.stack.length)
    this.stack.push(node)
    return true
  }

  leave() {
    this.stack.length = this.frames.pop()
  }
}

function findRoute(from, to) {
  var seen = Object.create(null)
  var active = [{from: from, via: []}]
  while (active.length) {
    let current = active.shift()
    for (var name in Node.types) {
      let type = Node.types[name]
      if (current.from.contain == type.type && !(type.contains in seen)) {
        let via = current.via.concat(type)
        if (type.contains == to.type) return via
        active.push({from: type, via: via})
        seen[type.contains] = true
      }
    }
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
  let params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) &&
      dom.firstChild.getAttribute("mm-params")
  context.insert(new Node("code_block", [new Node.Inline("text", null, dom.textContent)],
                          {params: params || null}))
}

tags.ul = (dom, context) => {
  let attrs = {bullet: dom.getAttribute("mm-bullet") || "-",
               tight: dom.hasAttribute("mm-tight")}
  wrap(dom, context, new Node("bullet_list", null, attrs))
}

tags.ol = (dom, context) => {
  let attrs = {order: dom.getAttribute("start") || 1,
               tight: dom.hasAttribute("mm-tight")}
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

import markdownit from "markdown-it"
import Node from "./node"

function parseTokens(state, toks) {
  for (let i = 0; i < toks.length; i++) {
    let tok = toks[i]
    tokens[tok.type](state, tok, i)
  }
}

export default function fromText(text) {
  let tokens = markdownit("commonmark").parse(text, {})
  let state = new State(tokens)
  parseTokens(state, tokens)
  return state.stack[0]
}

class State {
  constructor(tokens) {
    this.stack = [new Node("doc")]
    this.tokens = tokens
    this.styles = []
  }

  top() {
    return this.stack[this.stack.length - 1]
  }

  push(elt) {
    this.top().push(elt)
  }
}

const tokens = Object.create(null)

// These declare token types. `tokenWrap` for elements that use _open
// and _close tokens with more tokens in between them, and `token` for
// atomic tokens.

function addNode(state, type, attrs = Node.nullAttrs) {
  let node = new Node(type, null, attrs)
  state.push(node)
  return node
}

function openNode(state, type, attrs = Node.nullAttrs) {
  let node = addNode(state, type, attrs)
  state.stack.push(node)
  return node
}

function closeNode(state) {
  state.stack.pop()
  state.styles.length = 0
}

function openInline(state, style) {
  state.styles.push(style)
}

function closeInline(state, type) {
  for (let i = 0; i < state.styles.length; i++) {
    if (state.styles[i].type == type) {
      state.styles.splice(i, 1)
      return
    }
  }
}

const empty = []

function addInline(state, type, text = null, attrs = Node.nullAttrs) {
  let node = new Node.Inline(type, state.styles.length ? state.styles.slice() : empty,
                             text, attrs);
  state.push(node)
  return node
}

function addText(state, text) {
  let nodes = state.top().content, last = nodes[nodes.length - 1]
  if (last && Node.styles.same(last.styles, state.styles))
    last.text += text
  else
    addInline(state, "text", text)
}

function tokBlock(name, extra = null) {
  tokens[name + "_open"] = (state, tok, offset) => {
    let node = openNode(state, name)
    if (extra) extra(state, tok, node, offset)
  }
  tokens[name + "_close"] = closeNode
}

function tokInlineSpan(name, getStyle) {
  let styleName = ""
  tokens[name + "_open"] = (state, tok) => {
    let style = getStyle instanceof Function ? getStyle(state, tok) : getStyle
    styleName = style.type
    openInline(state, style)
  }
  tokens[name + "_close"] = (state, tok) => {
    closeInline(state, styleName)
  }
}

;["blockquote", "paragraph", "list_item", "table"].forEach(n => tokBlock(n))

tokBlock("bullet_list", (state, _tok, node, offset) => {
  node.attrs = {bullet: "FIXME", tight: state.tokens[offset + 2].tight}
})

tokBlock("ordered_list", (state, tok, node, offset) => {
  node.attrs = {order: Number(tok.order || 1), tight: state.tokens[offset + 2].tight}
})

tokBlock("heading", (_state, tok, node) => {
  node.attrs = {level: Number(tok.level)}
})

tokens.htmlblock = (state, tok) => {
  addNode(state, "html_block", {html: tok.content})
}

tokens.fence = (state, tok) => {
  openNode(state, "code_block", {params: tok.params || null})
  addText(state, tok.content)
  closeNode(state)
}

tokens.code = (state, tok) => {
  if (tok.block) {
    openNode(state, "code_block")
    addText(state, tok.content)
    closeNode(state)
  } else {
    openInline(state, Node.styles.code)
    addText(state, tok.content)
    closeInline(state, "code")
  }
}

tokInlineSpan("link", (_state, tok) => Node.styles.link(tok.href, tok.title || null))

tokens.image = (state, tok) => {
  addInline(state, "image", null, {src: tok.src, title: tok.title || null, alt: tok.alt || null})
}

tokens.hardbreak = (state, tok) => {
  addInline(state, "hard_break")
}

tokens.softbreak = (state, tok) => {
  addText(state, "\n")
}

tokens.text = (state, tok) => {
  addText(state, tok.content)
}

tokens.htmltag = (state, tok) => {
  addInline(state, "html_tag", null, {html: tok.content})
}

tokens.inline = (state, tok) => {
  parseTokens(state, tok.children)
}

tokInlineSpan("strong", Node.styles.strong)

tokInlineSpan("em", Node.styles.em)

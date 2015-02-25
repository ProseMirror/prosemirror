const markdownit = require("markdown-it")

const Node = require("./node")

function parseTokens(state, toks) {
  for (var i = 0; i < toks.length; i++) {
    const tok = toks[i]
    tokens[tok.type](state, tok, i)
  }
}

module.exports = function fromText(text) {
  const tokens = markdownit("commonmark").parse(text, {})
  const state = new State(tokens)
  parseTokens(state, tokens)
  return state.stack[0]
}

class State {
  constructor(tokens) {
    this.stack = [new Node("doc")]
    this.tokens = tokens
    this.styles = null
  }

  top() {
    return this.stack[this.stack.length - 1]
  }

  push(elt) {
    this.top().content.push(elt)
  }
}

const tokens = Object.create(null)

// These declare token types. `tokenWrap` for elements that use _open
// and _close tokens with more tokens in between them, and `token` for
// atomic tokens.

function addNode(state, type, attrs) {
  const node = new Node(type, null, attrs)
  state.push(node)
  return node
}

function openNode(state, type, attrs) {
  const node = addNode(state, type, attrs)
  state.stack.push(node)
  return node
}

function closeNode(state) {
  state.stack.pop()
  if (state.styles) state.styles = null
}

function openInline(state, style) {
  state.styles = state.styles ? state.styles.slice() : []
  state.styles.push(style)
}

function closeInline(state, type) {
  if (state.styles) for (var i = 0; i < state.styles.length; i++) {
    if (state.styles[i].type == type) {
      state.styles = state.styles.slice(0, i).concat(state.styles.slice(i + 1))
      return
    }
  }
}

const empty = []

function addText(state, text) {
  const top = state.top(), last = top.content[top.content.length - 1]
  if (last && last.attrsstyle == state.styles)
    last.attrs.text += text;
  else
    addNode(state, "text", {text: text, style: state.styles || empty})
}

function tokBlock(name, type, extra) {
  if (typeof type != "string") { extra = type; type = name }
  tokens[name + "_open"] = (state, tok, offset) => {
    const node = openNode(state, type)
    if (extra) extra(state, tok, node, offset)
  }
  tokens[name + "_close"] = closeNode
}

function tokInlineSpan(name, val) {
  var styleName
  tokens[name + "_open"] = (state, tok) => {
    const style = val instanceof Function ? val(state, tok) : val
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
    closeInline("code")
  }
}

tokInlineSpan("link", (_state, tok) => Node.styles.link(tok.href, tok.title || null))

tokens.image = (state, tok) => {
  addNode(state, "image", {src: tok.src, title: tok.title || null, alt: tok.alt || null})
}

tokens.hardbreak = (state, tok) => {
  addNode(state, "hard_break")
}

tokens.softbreak = (state, tok) => {
  addText(state, "\n")
}

tokens.text = (state, tok) => {
  addText(state, tok.content)
}

tokens.htmltag = (state, tok) => {
  addNode(state, "html_tag", {html: tok.content})
}

tokens.inline = (state, tok) => {
  parseTokens(state, tok.children)
}

tokInlineSpan("strong", Node.styles.strong)

tokInlineSpan("em", Node.styles.em)

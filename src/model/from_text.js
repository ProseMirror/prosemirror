import markdownit from "markdown-it"
import Node from "./node"
import * as style from "./style"

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
  if (state.styles.length)
    state.styles = []
}

function openInline(state, add) {
  state.styles = style.add(state.styles, add)
}

function closeInline(state, rm) {
  state.styles = style.remove(state.styles, rm)
}

function addInline(state, type, text = null, attrs = Node.nullAttrs) {
  let node = new Node.Inline(type, state.styles, text, attrs)
  state.push(node)
  return node
}

function addText(state, text) {
  let nodes = state.top().content, last = nodes[nodes.length - 1]
  if (last && last.type.name == "text" && style.sameSet(last.styles, state.styles))
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
  let styleObj
  tokens[name + "_open"] = (state, tok) => {
    styleObj = getStyle instanceof Function ? getStyle(state, tok) : getStyle
    openInline(state, styleObj)
  }
  tokens[name + "_close"] = (state, tok) => {
    closeInline(state, styleObj)
  }
}

function attr(tok, name) {
  if (tok.attrs) for (let i = 0; i < tok.attrs.length; i++)
    if (tok.attrs[i][0] == name) return tok.attrs[i][1]
}

;["blockquote", "paragraph", "list_item", "table"].forEach(n => tokBlock(n))

tokBlock("bullet_list", (state, tok, node, offset) => {
  node.attrs = {bullet: tok.markup, tight: state.tokens[offset + 2].hidden}
})

tokBlock("ordered_list", (state, tok, node, offset) => {
  node.attrs = {order: Number(attr(tok, "order") || 1), tight: state.tokens[offset + 2].hidden}
})

tokBlock("heading", (_state, tok, node) => {
  node.attrs = {level: Number(tok.tag.slice(1))}
})

tokens.htmlblock = (state, tok) => {
  addNode(state, "html_block", {html: tok.content})
}

tokens.fence = (state, tok) => {
  openNode(state, "code_block", {params: tok.info || null})
  addText(state, tok.content)
  closeNode(state)
}

tokens.code_block = (state, tok) => {
  openNode(state, "code_block")
  addText(state, tok.content)
  closeNode(state)
}

tokens.hr = (state, tok) => addNode(state, "horizontal_rule", {markup: tok.markup})

tokens.code_inline = (state, tok) => {
  openInline(state, style.code)
  addText(state, tok.content)
  closeInline(state, style.code)
}

tokInlineSpan("link", (_state, tok) => style.link(attr(tok, "href"), attr(tok, "title") || null))

tokens.image = (state, tok) => {
  addInline(state, "image", null, {src: attr(tok, "src"),
                                   title: attr(tok, "title") || null,
                                   alt: tok.children[0] && tok.children[0].content || null})
}

tokens.hardbreak = (state, tok) => addInline(state, "hard_break")

tokens.softbreak = (state, tok) => addText(state, "\n")

tokens.text = (state, tok) => addText(state, tok.content)

tokens.htmltag = (state, tok) => addInline(state, "html_tag", null, {html: tok.content})

tokens.inline = (state, tok) => parseTokens(state, tok.children)

tokInlineSpan("strong", style.strong)

tokInlineSpan("em", style.em)

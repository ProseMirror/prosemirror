import markdownit from "markdown-it"
import {Pos, style} from "../model"
import {defineSource} from "./index"

function parseTokens(state, toks) {
  for (let i = 0; i < toks.length; i++) {
    let tok = toks[i]
    tokens[tok.type](state, tok, i)
  }
}

export function fromMarkdown(schema, text) {
  let tokens = markdownit("commonmark").parse(text, {})
  let state = new State(schema, tokens), doc
  parseTokens(state, tokens)
  do { doc = closeNode(state) } while (state.stack.length)
  if (!Pos.start(doc)) doc = doc.splice(0, 0, [schema.node("paragraph")])
  return doc
}

defineSource("markdown", fromMarkdown)

class State {
  constructor(schema, tokens) {
    this.schema = schema
    this.stack = [{type: "doc", content: []}]
    this.tokens = tokens
    this.styles = []
  }

  top() {
    return this.stack[this.stack.length - 1]
  }

  push(elt) {
    if (this.stack.length)
      this.top().content.push(elt)
  }
}

const tokens = Object.create(null)

// These declare token types. `tokenWrap` for elements that use _open
// and _close tokens with more tokens in between them, and `token` for
// atomic tokens.

function addNode(state, type, attrs, content) {
  let node = state.schema.node(type, attrs, content)
  state.push(node)
  return node
}

function openNode(state, type, attrs) {
  state.stack.push({type: type, attrs: attrs, content: []})
}

function closeNode(state) {
  if (state.styles.length) state.styles = []
  let info = state.stack.pop()
  return addNode(state, info.type, info.attrs, info.content)
}

function openInline(state, add) {
  state.styles = style.add(state.styles, add)
}

function closeInline(state, rm) {
  state.styles = style.remove(state.styles, rm)
}

function addInline(state, type, text = null, attrs = null) {
  let node = state.schema.node(type, attrs, text, state.styles)
  state.push(node)
  return node
}

function addText(state, text) {
  let nodes = state.top().content, last = nodes[nodes.length - 1]
  let node = state.schema.text(text, state.styles), merged
  if (last && (merged = last.maybeMerge(node))) nodes[nodes.length - 1] = merged
  else nodes.push(node)
}

function tokBlock(name, getAttrs = null) {
  tokens[name + "_open"] = (state, tok, offset) => {
    openNode(state, name, getAttrs ? getAttrs(state, tok, offset) : null)
  }
  tokens[name + "_close"] = closeNode
}

function tokInlineSpan(name, getStyle) {
  let styleObj
  tokens[name + "_open"] = (state, tok) => {
    styleObj = getStyle instanceof Function ? getStyle(state, tok) : getStyle
    openInline(state, styleObj)
  }
  tokens[name + "_close"] = (state) => {
    closeInline(state, styleObj)
  }
}

function attr(tok, name) {
  if (tok.attrs) for (let i = 0; i < tok.attrs.length; i++)
    if (tok.attrs[i][0] == name) return tok.attrs[i][1]
}

;["blockquote", "paragraph", "list_item", "table"].forEach(n => tokBlock(n))

tokBlock("bullet_list", (state, tok, offset) => {
  return {bullet: tok.markup, tight: state.tokens[offset + 2].hidden}
})

tokBlock("ordered_list", (state, tok, offset) => {
  return {order: Number(attr(tok, "order") || 1), tight: state.tokens[offset + 2].hidden}
})

tokBlock("heading", (_state, tok) => {
  return {level: Number(tok.tag.slice(1))}
})

tokens.htmlblock = (state, tok) => {
  addNode(state, "html_block", {html: tok.content})
}

function cleanTrailingNewline(str) {
  if (str.charAt(str.length - 1) == "\n")
    return str.slice(0, str.length - 1)
  return str
}

tokens.fence = (state, tok) => {
  openNode(state, "code_block", {params: tok.info || ""})
  addText(state, cleanTrailingNewline(tok.content))
  closeNode(state)
}

tokens.code_block = (state, tok) => {
  openNode(state, "code_block")
  addText(state, cleanTrailingNewline(tok.content))
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

tokens.hardbreak = (state) => addInline(state, "hard_break")

tokens.softbreak = (state) => addText(state, "\n")

tokens.text = (state, tok) => addText(state, tok.content)

tokens.htmltag = (state, tok) => addInline(state, "html_tag", null, {html: tok.content})

tokens.inline = (state, tok) => parseTokens(state, tok.children)

tokInlineSpan("strong", style.strong)

tokInlineSpan("em", style.em)

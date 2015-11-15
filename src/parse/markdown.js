import markdownit from "markdown-it"
import {BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle,
        removeStyle} from "../model"
import {defineSource} from "./index"

export function fromMarkdown(schema, text) {
  let tokens = markdownit("commonmark").parse(text, {})
  let state = new State(schema, tokens), doc
  state.parseTokens(tokens)
  do { doc = state.closeNode() } while (state.stack.length)
  return doc
}

// FIXME create a schema for defining these without importing this file

defineSource("markdown", fromMarkdown)

class State {
  constructor(schema, tokens) {
    this.schema = schema
    this.stack = [{type: schema.nodes.doc, content: []}]
    this.tokens = tokens
    this.styles = []
    this.tokenTypes = tokenTypeInfo(schema)
  }

  top() {
    return this.stack[this.stack.length - 1]
  }

  push(elt) {
    if (this.stack.length)
      this.top().content.push(elt)
  }

  addText(text) {
    let nodes = this.top().content, last = nodes[nodes.length - 1]
    let node = this.schema.text(text, this.styles), merged
    if (last && (merged = last.maybeMerge(node))) nodes[nodes.length - 1] = merged
    else nodes.push(node)
  }

  openInline(add) {
    this.styles = add.addToSet(this.styles)
  }

  closeInline(rm) {
    this.styles = removeStyle(this.styles, rm)
  }

  parseTokens(toks) {
    for (let i = 0; i < toks.length; i++) {
      let tok = toks[i]
      this.tokenTypes[tok.type](this, tok)
    }
  }

  addInline(type, text = null, attrs = null) {
    let node = type.create(attrs, text, this.styles)
    this.push(node)
    return node
  }

  addNode(type, attrs, content) {
    let node = type.createAutoFill(attrs, content)
    this.push(node)
    return node
  }

  openNode(type, attrs) {
    this.stack.push({type: type, attrs: attrs, content: []})
  }

  closeNode() {
    if (this.styles.length) this.styles = []
    let info = this.stack.pop()
    return this.addNode(info.type, info.attrs, info.content)
  }

  getAttr(tok, name) {
    if (tok.attrs) for (let i = 0; i < tok.attrs.length; i++)
      if (tok.attrs[i][0] == name) return tok.attrs[i][1]
  }
}

function tokenTypeInfo(schema) {
  return schema.cached.markdownTokens ||
    (schema.cached.markdownTokens = summarizeTokens(schema))
}

function registerTokens(tokens, type, info) {
  if (info.type == "block") {
    tokens[info.token + "_open"] = (state, tok) => {
      let attrs = typeof info.attrs == "function" ? info.attrs(state, tok) : info.attrs
      state.openNode(type, attrs)
    }
    tokens[info.token + "_close"] = state => state.closeNode()
  } else if (info.type == "inline") {
    tokens[info.token + "_open"] = (state, tok) => {
      let attrs = info.attrs instanceof Function ? info.attrs(state, tok) : info.attrs
      state.openInline(type.create(attrs))
    }
    tokens[info.token + "_close"] = state => state.closeInline(type)
  } else if (info.parse) {
    tokens[info.token] = info.parse.bind(type)
  } else {
    throw new Error("Unrecognized markdown parsing spec: " + info)
  }
}

function summarizeTokens(schema) {
  let tokens = Object.create(null)
  tokens.text = (state, tok) => state.addText(tok.content)
  tokens.inline = (state, tok) => state.parseTokens(tok.children)
  tokens.softbreak = state => state.addText("\n")

  function read(type) {
    let info = type.parseMarkdown
    if (info) info.forEach(info => registerTokens(tokens, type, info))
  }

  for (let name in schema.nodes) read(schema.nodes[name])
  for (let name in schema.styles) read(schema.styles[name])
  return tokens
}

BlockQuote.register("parseMarkdown", {type: "block", token: "blockquote"})

Paragraph.register("parseMarkdown", {type: "block", token: "paragraph"})

ListItem.register("parseMarkdown", {type: "block", token: "list_item"})

BulletList.register("parseMarkdown", {type: "block", token: "bullet_list"})

OrderedList.register("parseMarkdown", {type: "block", token: "ordered_list", attrs: (state, tok) => ({
  order: Number(state.getAttr(tok, "order") || 1)
})})

Heading.register("parseMarkdown", {type: "block", token: "heading", attrs: (_, tok) => ({
  level: tok.tag.slice(1)
})})

function trimTrailingNewline(str) {
  if (str.charAt(str.length - 1) == "\n")
    return str.slice(0, str.length - 1)
  return str
}

function parseCodeBlock(state, tok) {
  state.openNode(this)
  state.addText(trimTrailingNewline(tok.content))
  state.closeNode()
}

CodeBlock.register("parseMarkdown", {token: "code_block", parse: parseCodeBlock})
CodeBlock.register("parseMarkdown", {token: "fence", parse: parseCodeBlock})

HorizontalRule.register("parseMarkdown", {token: "hr", parse: function(state, tok) {
  state.addNode(this, {markup: tok.markup})
}})

Image.register("parseMarkdown", {token: "image", parse: function(state, tok) {
  state.addInline(this, null, {src: state.getAttr(tok, "src"),
                               title: state.getAttr(tok, "title") || null,
                               alt: tok.children[0] && tok.children[0].content || null})
}})

HardBreak.register("parseMarkdown", {token: "hardbreak", parse: function(state) {
  state.addInline(this)
}})

// Inline styles

EmStyle.register("parseMarkdown", {type: "inline", token: "em"})

StrongStyle.register("parseMarkdown", {type: "inline", token: "strong"})

LinkStyle.register("parseMarkdown", {
  type: "inline",
  token: "link",
  attrs: (state, tok) => ({
    href: state.getAttr(tok, "href"),
    title: state.getAttr(tok, "title") || null
  })
})

CodeStyle.register("parseMarkdown", {token: "code_inline", parse: function(state, tok) {
  state.openInline(this.create())
  state.addText(tok.content)
  state.closeInline(this)
}})

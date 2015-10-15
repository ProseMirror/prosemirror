import markdownit from "markdown-it"
import {NodeType, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        defaultSchema, Pos} from "../model"
import {defineSource} from "./index"

export function fromMarkdown(schema, text) {
  let tokens = markdownit("commonmark").parse(text, {})
  let state = new State(schema, tokens), doc
  state.parseTokens(tokens)
  do { doc = state.closeNode() } while (state.stack.length)
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
    this.styles = rm.removeFromSet(this.styles)
  }

  parseTokens(toks) {
    for (let i = 0; i < toks.length; i++) {
      let tok = toks[i]
      this.tokenTypes[tok.type](this, tok, i)
    }
  }

  addInline(type, text = null, attrs = null) {
    let node = this.schema.node(type, attrs, text, this.styles)
    this.push(node)
    return node
  }

  addNode(type, attrs, content) {
    let node = this.schema.node(type, attrs, content)
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

function summarizeTokens(schema) {
  let tokens = Object.create(null)
  tokens.text = (state, tok) => state.addText(tok.content)
  tokens.inline = (state, tok) => state.parseTokens(tok.children)
  tokens.softbreak = state => state.addText("\n")

  function read(obj) {
    if (obj.markdownRegisterTokens) obj.markdownRegisterTokens(tokens)
  }

  for (let name in schema.nodeTypes) read(schema.nodeTypes[name])
  for (let name in schema.styles) read(schema.styles[name])
  return tokens
}

function addMarkdownMethod(ctor, method) {
  if (ctor.prototype.hasOwnProperty("markdownRegisterTokens")) {
    let a = ctor.prototype.markdownRegisterTokens, b = method
    method = function(tokens) {
      a.call(this, tokens)
      b.call(this, tokens)
    }
  }
  ctor.prototype.markdownRegisterTokens = method
}

NodeType.markdownBlock = function(tokenName, readAttrs) {
  addMarkdownMethod(this, function(tokens) {
    tokens[tokenName + "_open"] = (state, tok) => {
      state.openNode(this, readAttrs ? readAttrs(state, tok) : null)
    }
    tokens[tokenName + "_close"] = state => state.closeNode()
  })
}

NodeType.markdownToken = function(tokenName, parser) {
  addMarkdownMethod(this, function(tokens) {
    tokens[tokenName] = (state, tok) => {
      parser(state, tok, this)
    }
  })
}

BlockQuote.markdownBlock("blockquote")

Paragraph.markdownBlock("paragraph")

ListItem.markdownBlock("list_item")

BulletList.markdownBlock("bullet_list")

OrderedList.markdownBlock("ordered_list", (state, tok) => {
  return {order: Number(state.getAttr(tok, "order") || 1)}
})

Heading.markdownBlock("heading", (_state, tok) => {
  return {level: Number(tok.tag.slice(1))}
})

function trimTrailingNewline(str) {
  if (str.charAt(str.length - 1) == "\n")
    return str.slice(0, str.length - 1)
  return str
}

function parseCodeBlock(state, tok, type) {
  state.openNode(type)
  state.addText(trimTrailingNewline(tok.content))
  state.closeNode()
}

CodeBlock.markdownToken("code_block", parseCodeBlock)
CodeBlock.markdownToken("fence", parseCodeBlock)

HorizontalRule.markdownToken("hr", (state, tok, type) => {
  state.addNode(type, {markup: tok.markup})
})

Image.markdownToken("image", (state, tok, type) => {
  state.addInline(type, null, {src: state.getAttr(tok, "src"),
                               title: state.getAttr(tok, "title") || null,
                               alt: tok.children[0] && tok.children[0].content || null})
})

HardBreak.markdownToken("hardbreak", (state, _, type) => state.addInline(type))

// FIXME move to proper exported objects/prototypes

function markdownInline(style, tokenName, getStyle) {
  style.markdownRegisterTokens = function(tokens) {
    let styleObj
    tokens[tokenName + "_open"] = (state, tok) => {
      styleObj = getStyle instanceof Function ? getStyle(state, tok) : getStyle
      state.openInline(styleObj)
    }
    tokens[tokenName + "_close"] = state => state.closeInline(styleObj)
  }
}

markdownInline(defaultSchema.styles.link, "link",
               (state, tok) => defaultSchema.style("link", {
                 href: state.getAttr(tok, "href"),
                 title: state.getAttr(tok, "title") || null
               }))

markdownInline(defaultSchema.styles.strong, "strong", defaultSchema.style("strong"))

markdownInline(defaultSchema.styles.em, "em", defaultSchema.style("em"))

defaultSchema.styles.code.markdownRegisterTokens = function(tokens) {
  tokens.code_inline = (state, tok) => {
    state.openInline(defaultSchema.style("code"))
    state.addText(tok.content)
    state.closeInline(defaultSchema.style("code"))
  }
}

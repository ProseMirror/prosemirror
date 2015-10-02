import {style} from "../model"
import {defineTarget} from "./index"

export function toMarkdown(doc) {
  let state = new State()
  state.renderNodes(doc.children)
  return state.out
}

defineTarget("markdown", toMarkdown)

function esc(str, startOfLine) {
  str = str.replace(/[`*\\~+\[\]]/g, "\\$&")
  if (startOfLine) str = str.replace(/^[:#-]/, "\\$&")
  return str
}

function quote(str) {
  var wrap = str.indexOf('"') == -1 ? '""' : str.indexOf("'") == -1 ? "''" : "()"
  return wrap[0] + str + wrap[1]
}

function rep(str, n) {
  let out = ""
  for (let i = 0; i < n; i++) out += str
  return out
}

class State {
  constructor() {
    this.delim = this.out = ""
    this.closed = false
    this.inTightList = false
  }

  closeBlock(node) {
    this.closed = node
  }

  flushClose(size) {
    if (this.closed) {
      if (!this.atBlank()) this.out += "\n"
      if (size == null) size = 2
      if (size > 1) {
        let delimMin = this.delim
        let trim = /\s+$/.exec(delimMin)
        if (trim) delimMin = delimMin.slice(0, delimMin.length - trim[0].length)
        for (let i = 1; i < size; i++)
          this.out += delimMin + "\n"
      }
      this.closed = false
    }
  }

  wrapBlock(delim, firstDelim, node, f) {
    let old = this.delim
    this.write(firstDelim || delim)
    this.delim += delim
    f()
    this.delim = old
    this.closeBlock(node)
  }

  atBlank() {
    return /(^|\n)$/.test(this.out)
  }

  write(add) {
    this.flushClose()
    if (this.delim && this.atBlank())
      this.out += this.delim
    if (add) this.out += add
  }

  text(text, escape) {
    let lines = text.split("\n")
    for (let i = 0; i < lines.length; i++) {
      var startOfLine = this.atBlank() || this.closed
      this.write()
      this.out += escape !== false ? esc(lines[i], startOfLine) : lines[i]
      if (i != lines.length - 1) this.out += "\n"
    }
  }

  ensureNewLine() {
    if (!this.atBlank()) this.out += "\n"
  }

  render(node) {
    render[node.type.name](this, node)
  }

  renderNodes(nodes) {
    for (let i = 0; i < nodes.length; i++)
      this.render(nodes[i])
  }

  renderInline(nodes) {
    let stack = []
    for (let i = 0; i <= nodes.length; i++) {
      let node = nodes[i]
      let styles = node ? node.styles.slice() : []
      if (stack.length && stack[stack.length - 1].type == "code" &&
          (!styles.length || styles[styles.length - 1].type != "code")) {
        this.text("`", false)
        stack.pop()
      }
      for (let j = 0; j < stack.length; j++) {
        let cur = stack[j], found = false
        for (let k = 0; k < styles.length; k++) {
          if (style.same(stack[j], styles[k])) {
            styles.splice(k, 1)
            found = true
            break
          }
        }
        if (!found) {
          let closer = close_style[cur.type]
          this.text(typeof closer != "string" ? closer(cur) : closer, false)
          stack.splice(j--, 1)
        }
      }
      for (let j = 0; j < styles.length; j++) {
        let cur = styles[j]
        stack.push(cur)
        this.text(open_style[cur.type], false)
      }
      if (node) this.render(node)
    }
  }

  renderList(node, delim, firstDelim) {
    if (this.closed && this.closed.type == node.type)
      this.flushClose(3)
    else if (this.inTightList)
      this.flushClose(1)

    let prevTight = this.inTightList
    this.inTightList = node.attrs.tight
    for (let i = 0; i < node.width; i++) {
      if (i && node.attrs.tight) this.flushClose(1)
      let item = node.child(i)
      this.wrapBlock(delim, firstDelim(i), node, () => this.render(item))
    }
    this.inTightList = prevTight
  }
}

const render = Object.create(null)

render.blockquote = (state, node) => {
  state.wrapBlock("> ", null, node, () => state.renderNodes(node.children))
}

render.code_block = (state, node) => {
  if (node.attrs.params == null) {
    state.wrapBlock("    ", null, node, () => state.text(node.textContent, false))
  } else {
    state.write("```" + node.attrs.params + "\n")
    state.text(node.textContent, false)
    state.ensureNewLine()
    state.write("```")
    state.closeBlock(node)
  }
}

render.heading = (state, node) => {
  state.write(rep("#", node.attrs.level) + " ")
  state.renderInline(node.children)
  state.closeBlock(node)
}

render.horizontal_rule = (state, node) => {
  state.write(node.attrs.markup || "---")
  state.closeBlock(node)
}



render.bullet_list = (state, node) => {
  state.renderList(node, "  ", () => node.attrs.bullet + " ")
}

render.ordered_list = (state, node) => {
  let start = Number(node.attrs.order || 1)
  let maxW = String(start + node.width - 1).length
  let space = rep(" ", maxW + 2)
  state.renderList(node, space, i => {
    let nStr = String(start + i)
    return rep(" ", maxW - nStr.length) + nStr + ". "
  })
}

render.list_item = (state, node) => state.renderNodes(node.children)

render.html_block = (state, node) => {
  state.text(node.attrs.html, false)
  state.closeBlock(node)
}

render.paragraph = (state, node) => {
  state.renderInline(node.children)
  state.closeBlock(node)
}

// Inline nodes

render.image = (state, node) => {
  state.write("![" + esc(node.attrs.alt || "") + "](" + esc(node.attrs.src) +
              (node.attrs.title ? " " + quote(node.attrs.title) : "") + ")")
}

render.hard_break = state => state.write("\\\n")

render.text = (state, node) => state.text(node.text)

render.html_tag = (state, node) => state.text(node.attrs.html)

// Styles

function closeLink(style) {
  return "](" + esc(style.href) + (style.title ? " " + quote(style.title) : "") + ")"
}

const open_style = {link: "[", strong: "**", em: "*", code: "`"}
const close_style = {link: closeLink, strong: "**", em: "*", code: "`"}

import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmStyle, StrongStyle, LinkStyle, CodeStyle} from "../model"
import {defineTarget} from "./index"

export function toMarkdown(doc) {
  let state = new State()
  state.renderContent(doc)
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
    node.type.serializeMarkdown(this, node)
  }

  renderContent(node) {
    for (let i = 0; i < node.size; i++) this.render(node.get(i))
  }

  renderInline(parent) {
    let active = []
    parent.chunks((node, text, marks) => {
      let keep = 0
      for (; keep < Math.min(active.length, marks.length); ++keep)
        if (!marks[keep].eq(active[keep])) break
      while (keep < active.length)
        this.text(styleString(active.pop(), false), false)
      while (active.length < marks.length) {
        let add = mark[active.length]
        active.push(add)
        this.text(styleString(add, true), false)
      }
      if (text) this.text(text)
      else this.render(node)
    })
    for (let i = active.lengh - 1; i >= 0; i--)
      this.text(styleString(active[i], false), false)
  }

  renderList(node, delim, firstDelim) {
    if (this.closed && this.closed.type == node.type)
      this.flushClose(3)
    else if (this.inTightList)
      this.flushClose(1)

    let prevTight = this.inTightList
    this.inTightList = node.attrs.tight
    for (let i = 0; i < node.size; i++) {
      if (i && node.attrs.tight) this.flushClose(1)
      let item = node.child(i)
      this.wrapBlock(delim, firstDelim(i), node, () => this.render(item))
    }
    this.inTightList = prevTight
  }
}

function def(cls, method) { cls.prototype.serializeMarkdown = method }

def(BlockQuote, (state, node) => {
  state.wrapBlock("> ", null, node, () => state.renderContent(node))
})

def(CodeBlock, (state, node) => {
  if (node.attrs.params == null) {
    state.wrapBlock("    ", null, node, () => state.text(node.textContent, false))
  } else {
    state.write("```" + node.attrs.params + "\n")
    state.text(node.textContent, false)
    state.ensureNewLine()
    state.write("```")
    state.closeBlock(node)
  }
})

def(Heading, (state, node) => {
  state.write(rep("#", node.attrs.level) + " ")
  state.renderInline(node)
  state.closeBlock(node)
})

def(HorizontalRule, (state, node) => {
  state.write(node.attrs.markup || "---")
  state.closeBlock(node)
})

def(BulletList, (state, node) => {
  state.renderList(node, "  ", () => (node.attrs.bullet || "*") + " ")
})

def(OrderedList, (state, node) => {
  let start = Number(node.attrs.order || 1)
  let maxW = String(start + node.size - 1).length
  let space = rep(" ", maxW + 2)
  state.renderList(node, space, i => {
    let nStr = String(start + i)
    return rep(" ", maxW - nStr.length) + nStr + ". "
  })
})

def(ListItem, (state, node) => state.renderContent(node))

def(Paragraph, (state, node) => {
  state.renderInline(node)
  state.closeBlock(node)
})

// Inline nodes

def(Image, (state, node) => {
  state.write("![" + esc(node.attrs.alt || "") + "](" + esc(node.attrs.src) +
              (node.attrs.title ? " " + quote(node.attrs.title) : "") + ")")
})

def(HardBreak, state => state.write("\\\n"))

def(Text, (state, node) => state.text(node.text))

// Styles

function styleString(style, open) {
  let value = open ? style.type.openMarkdownStyle : style.type.closeMarkdownStyle
  return typeof value == "string" ? value : value(style)
}

function defStyle(style, open, close) {
  style.prototype.openMarkdownStyle = open
  style.prototype.closeMarkdownStyle = close
}

defStyle(EmStyle, "*", "*")

defStyle(StrongStyle, "**", "**")

defStyle(LinkStyle, "[",
         style => "](" + esc(style.attrs.href) + (style.attrs.title ? " " + quote(style.attrs.title) : "") + ")")

defStyle(CodeStyle, "`", "`")

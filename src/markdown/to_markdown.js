import {Text, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak,
        EmMark, StrongMark, LinkMark, CodeMark} from "../model"
import {defineTarget} from "../format"

// :: (Node) → string
// Serialize the content of the given node to [CommonMark](http://commonmark.org/).
//
// To define serialization behavior for your own [node
// types](#NodeType), give them a `serializeMarkDown` method. It will
// be called with a `MarkdownSerializer` and a `Node`, and should
// update the serializer's state to add the content of the node.
//
// [Mark types](#MarkType) can define `openMarkdown` and
// `closeMarkdown` properties, which provide the markup text that
// marked content should be wrapped in. They may hold either a string
// or a function from a `MarkdownSerializer` and a `Mark` to a string.
export function toMarkdown(doc) {
  let state = new MarkdownSerializer
  state.renderContent(doc)
  return state.out
}

defineTarget("markdown", toMarkdown)

// ;; This is an object used to track state and expose
// methods related to markdown serialization. Instances are passed to
// node and mark serialization methods (see `toMarkdown`).
class MarkdownSerializer {
  constructor() {
    this.delim = this.out = ""
    this.closed = false
    this.inTightList = false
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

  // :: (string, ?string, Node, ())
  // Render a block, prefixing each line with `delim`, and the first
  // line in `firstDelim`. `node` should be the node that is closed at
  // the end of the block, and `f` is a function that renders the
  // content of the block.
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

  // :: ()
  // Ensure the current content ends with a newline.
  ensureNewLine() {
    if (!this.atBlank()) this.out += "\n"
  }

  // :: (?string)
  // Prepare the state for writing output (closing closed paragraphs,
  // adding delimiters, and so on), and then optionally add content
  // (unescaped) to the output.
  write(content) {
    this.flushClose()
    if (this.delim && this.atBlank())
      this.out += this.delim
    if (content) this.out += content
  }

  // :: (Node)
  // Close the block for the given node.
  closeBlock(node) {
    this.closed = node
  }

  // :: (string, ?bool)
  // Add the given text to the document. When escape is not `false`,
  // it will be escaped.
  text(text, escape) {
    let lines = text.split("\n")
    for (let i = 0; i < lines.length; i++) {
      var startOfLine = this.atBlank() || this.closed
      this.write()
      this.out += escape !== false ? this.esc(lines[i], startOfLine) : lines[i]
      if (i != lines.length - 1) this.out += "\n"
    }
  }

  // :: (Node)
  // Render the given node as a block.
  render(node) {
    node.type.serializeMarkdown(this, node)
  }

  // :: (Node)
  // Render the contents of `parent` as block nodes.
  renderContent(parent) {
    parent.forEach(child => this.render(child))
  }

  // :: (Node)
  // Render the contents of `parent` as inline content.
  renderInline(parent) {
    let stack = []
    let progress = node => {
      let marks = node ? node.marks.slice() : []
      if (stack.length && stack[stack.length - 1].type == "code" &&
          (!marks.length || marks[marks.length - 1].type != "code")) {
        this.text("`", false)
        stack.pop()
      }
      for (let j = 0; j < stack.length; j++) {
        let cur = stack[j], found = false
        for (let k = 0; k < marks.length; k++) {
          if (marks[k].eq(stack[j])) {
            marks.splice(k, 1)
            found = true
            break
          }
        }
        if (!found) {
          this.text(this.markString(cur, false), false)
          stack.splice(j--, 1)
        }
      }
      for (let j = 0; j < marks.length; j++) {
        let cur = marks[j]
        stack.push(cur)
        this.text(this.markString(cur, true), false)
      }
      if (node) this.render(node)
    }
    parent.forEach(progress)
    progress(null)
  }

  renderList(node, delim, firstDelim) {
    if (this.closed && this.closed.type == node.type)
      this.flushClose(3)
    else if (this.inTightList)
      this.flushClose(1)

    let prevTight = this.inTightList
    this.inTightList = node.attrs.tight
    for (let i = node.iter(), n = 0, item; item = i.next().value; n++) {
      if (n && node.attrs.tight) this.flushClose(1)
      this.wrapBlock(delim, firstDelim(n), node, () => this.render(item))
    }
    this.inTightList = prevTight
  }

  // :: (string, ?bool) → string
  // Escape the given string so that it can safely appear in Markdown
  // content. If `startOfLine` is true, also escape characters that
  // has special meaning only at the start of the line.
  esc(str, startOfLine) {
    str = str.replace(/[`*\\~+\[\]]/g, "\\$&")
    if (startOfLine) str = str.replace(/^[:#-]/, "\\$&")
    return str
  }

  quote(str) {
    var wrap = str.indexOf('"') == -1 ? '""' : str.indexOf("'") == -1 ? "''" : "()"
    return wrap[0] + str + wrap[1]
  }

  // :: (string, number) → string
  // Repeat the given string `n` times.
  repeat(str, n) {
    let out = ""
    for (let i = 0; i < n; i++) out += str
    return out
  }

  markString(mark, open) {
    let value = open ? mark.type.openMarkdown : mark.type.closeMarkdown
    return typeof value == "string" ? value : value(this, mark)
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
  state.write(state.repeat("#", node.attrs.level) + " ")
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
  let space = state.repeat(" ", maxW + 2)
  state.renderList(node, space, i => {
    let nStr = String(start + i)
    return state.repeat(" ", maxW - nStr.length) + nStr + ". "
  })
})

def(ListItem, (state, node) => state.renderContent(node))

def(Paragraph, (state, node) => {
  state.renderInline(node)
  state.closeBlock(node)
})

// Inline nodes

def(Image, (state, node) => {
  state.write("![" + state.esc(node.attrs.alt || "") + "](" + state.esc(node.attrs.src) +
              (node.attrs.title ? " " + state.quote(node.attrs.title) : "") + ")")
})

def(HardBreak, state => state.write("\\\n"))

def(Text, (state, node) => state.text(node.text))

// Marks

function defMark(mark, open, close) {
  mark.prototype.openMarkdown = open
  mark.prototype.closeMarkdown = close
}

defMark(EmMark, "*", "*")

defMark(StrongMark, "**", "**")

defMark(LinkMark, "[",
        (state, mark) => "](" + state.esc(mark.attrs.href) + (mark.attrs.title ? " " + state.quote(mark.attrs.title) : "") + ")")

defMark(CodeMark, "`", "`")

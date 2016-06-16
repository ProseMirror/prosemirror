// ;; A specification for serializing a ProseMirror document as
// Markdown/CommonMark text.
class MarkdownSerializer {
  // :: (Object<(MarkdownSerializerState, Node)>, Object)

  // Construct a serializer with the given configuration. The `nodes`
  // object should map node names in a given schema to function that
  // take a serializer state and such a node, and serialize the node.
  //
  // The `marks` object should hold objects with `open` and `close`
  // properties, which hold the strings that should appear before and
  // after a piece of text marked that way, either directly or as a
  // function that takes a serializer state and a mark, and returns a
  // string.
  //
  // Mark information objects can also have a `mixable` property
  // which, when `true`, indicates that the order in which the mark's
  // opening and closing syntax appears relative to other mixable
  // marks can be varied. (For example, you can say `**a *b***` and
  // `*a **b***`, but not `` `a *b*` ``.)
  constructor(nodes, marks) {
    // :: Object<(MarkdownSerializerState, Node)> The node serializer
    // functions for this serializer.
    this.nodes = nodes
    // :: Object The mark serializer info.
    this.marks = marks
  }

  // :: (Node, ?Object) → string
  // Serialize the content of the given node to
  // [CommonMark](http://commonmark.org/).
  serialize(content, options) {
    let state = new MarkdownSerializerState(this.nodes, this.marks, options)
    state.renderContent(content)
    return state.out
  }
}
exports.MarkdownSerializer = MarkdownSerializer

// :: MarkdownSerializer
// A serializer for the [basic schema](#schema).
const defaultMarkdownSerializer = new MarkdownSerializer({
  blockquote(state, node) {
    state.wrapBlock("> ", null, node, () => state.renderContent(node))
  },
  code_block(state, node) {
    if (node.attrs.params == null) {
      state.wrapBlock("    ", null, node, () => state.text(node.textContent, false))
    } else {
      state.write("```" + node.attrs.params + "\n")
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write("```")
      state.closeBlock(node)
    }
  },
  heading(state, node) {
    state.write(state.repeat("#", node.attrs.level) + " ")
    state.renderInline(node)
    state.closeBlock(node)
  },
  horizontal_rule(state, node) {
    state.write(node.attrs.markup || "---")
    state.closeBlock(node)
  },
  bullet_list(state, node) {
    state.renderList(node, "  ", () => (node.attrs.bullet || "*") + " ")
  },
  ordered_list(state, node) {
    let start = node.attrs.order || 1
    let maxW = String(start + node.childCount - 1).length
    let space = state.repeat(" ", maxW + 2)
    state.renderList(node, space, i => {
      let nStr = String(start + i)
      return state.repeat(" ", maxW - nStr.length) + nStr + ". "
    })
  },
  list_item(state, node) {
    state.renderContent(node)
  },
  paragraph(state, node) {
    state.renderInline(node)
    state.closeBlock(node)
  },

  image(state, node) {
    state.write("![" + state.esc(node.attrs.alt || "") + "](" + state.esc(node.attrs.src) +
                (node.attrs.title ? " " + state.quote(node.attrs.title) : "") + ")")
  },
  hard_break(state) {
    state.write("\\\n")
  },
  text(state, node) {
    state.text(node.text)
  }
}, {
  em: {open: "*", close: "*", mixable: true},
  strong: {open: "**", close: "**", mixable: true},
  link: {
    open: "[",
    close(state, mark) {
      return "](" + state.esc(mark.attrs.href) + (mark.attrs.title ? " " + state.quote(mark.attrs.title) : "") + ")"
    }
  },
  code: {open: "`", close: "`"}
})
exports.defaultMarkdownSerializer = defaultMarkdownSerializer

// ;; This is an object used to track state and expose
// methods related to markdown serialization. Instances are passed to
// node and mark serialization methods (see `toMarkdown`).
class MarkdownSerializerState {
  constructor(nodes, marks, options) {
    this.nodes = nodes
    this.marks = marks
    this.delim = this.out = ""
    this.closed = false
    this.inTightList = false
    // :: Object
    // The options passed to the serializer.
    this.options = options || {}
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
    this.nodes[node.type.name](this, node)
  }

  // :: (Node)
  // Render the contents of `parent` as block nodes.
  renderContent(parent) {
    parent.forEach(child => this.render(child))
  }

  // :: (Node)
  // Render the contents of `parent` as inline content.
  renderInline(parent) {
    let active = []
    let progress = node => {
      let marks = node ? node.marks : []
      let code = marks.length && marks[marks.length - 1].type.isCode && marks[marks.length - 1]
      let len = marks.length - (code ? 1 : 0)

      // Try to reorder 'mixable' marks, such as em and strong, which
      // in Markdown may be opened and closed in different order, so
      // that order of the marks for the token matches the order in
      // active.
      outer: for (let i = 0; i < len; i++) {
        let mark = marks[i]
        if (!this.marks[mark.type.name].mixable) break
        for (let j = 0; j < active.length; j++) {
          let other = active[j]
          if (!this.marks[other.type.name].mixable) break
          if (mark.eq(other)) {
            if (i > j)
              marks = marks.slice(0, j).concat(mark).concat(marks.slice(j, i)).concat(marks.slice(i + 1, len))
            else if (j > i)
              marks = marks.slice(0, i).concat(marks.slice(i + 1, j)).concat(mark).concat(marks.slice(j, len))
            continue outer
          }
        }
      }

      // Find the prefix of the mark set that didn't change
      let keep = 0
      while (keep < Math.min(active.length, len) && marks[keep].eq(active[keep])) ++keep

      // Close the marks that need to be closed
      while (keep < active.length)
        this.text(this.markString(active.pop(), false), false)

      // Open the marks that need to be opened
      while (active.length < len) {
        let add = marks[active.length]
        active.push(add)
        this.text(this.markString(add, true), false)
      }

      // Render the node. Special case code marks, since their content
      // may not be escaped.
      if (node) {
        if (code && node.isText)
          this.text(this.markString(code, false) + node.text + this.markString(code, true), false)
        else
          this.render(node)
      }
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
    for (let i = 0; i < node.childCount; i++) {
      if (i && node.attrs.tight) this.flushClose(1)
      this.wrapBlock(delim, firstDelim(i), node, () => this.render(node.child(i)))
    }
    this.inTightList = prevTight
  }

  // :: (string, ?bool) → string
  // Escape the given string so that it can safely appear in Markdown
  // content. If `startOfLine` is true, also escape characters that
  // has special meaning only at the start of the line.
  esc(str, startOfLine) {
    str = str.replace(/[`*\\~+\[\]]/g, "\\$&")
    if (startOfLine) str = str.replace(/^[:#-*]/, "\\$&").replace(/^(\d+)\./, "$1\\.")
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

  // : (Mark, bool) → string
  // Get the markdown string for a given opening or closing mark.
  markString(mark, open) {
    let info = this.marks[mark.type.name]
    let value = open ? info.open : info.close
    return typeof value == "string" ? value : value(this, mark)
  }
}
exports.MarkdownSerializerState = MarkdownSerializerState

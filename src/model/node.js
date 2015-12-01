import {sameStyles} from "./style"

export class Slice {
  append(other, joinLeft = 0, joinRight = 0) {
    if (!this.size)
      return joinRight ? slice.replace(0, slice.get(0).close(joinRight - 1, "start")) : slice
    if (!other.size)
      return joinLeft ? this.replace(this.size - 1, this.get(this.size - 1).close(joinLeft - 1, "end")) : this
    return this.appendInner(other, joinLeft, joinRight)
  }

  static fromJSON(schema, value) {
    if (!value || !value.length) return emptySlice
    let type = schema.nodes[value[0].type]
    return type.isInline ? TextSlice.fromJSON(schema, value) : FlatSlice.fromJSON(schema, value)
  }

  static from(nodes) {
    if (!nodes) return emptySlice
    if (nodes instanceof Slice) return nodes
    if (!Array.isArray(nodes)) nodes = [nodes]
    else if (!nodes.length) return emptySlice
    return nodes[0].type.isInline ? TextSlice.from(nodes) : FlatSlice.from(nodes)
  }

  static fromText(text, marks) {
    if (!text) return emptySlice
    return new TextSlice([new TextChunk(text, marks || emptyArray)])
  }
}

export class FlatSlice extends Slice {
  constructor(content) {
    super()
    this.content = content
  }

  indexOf(elt, start) { return this.content.indexOf(elt, start || 0) }
  atIndex(i) { return this.content[i] }
  get indexLength() { return this.content.length }

  get size() { return this.content.length }

  get(off) {
    if (off < 0 || off >= this.content.length) throw new Error("Child index " + i + " out of range")
    return this.content[off]
  }

  nodes(f) {
    for (let i = 0; i < this.content.length; i++)
      f(this.content[i], i)
  }

  chunkBefore(off) {
    return {node: this.get(off - 1), start: off - 1}
  }
  chunkAfter(off) {
    return {node: this.get(off), start: off}
  }

  chunks(f) {
    for (let i = 0; i < this.content.length; i++)
      f(this.content[i], null, this.content[i].marks, i, i + 1)
  }

  slice(from, to = this.size) {
    return new FlatSlice(this.content.slice(from, to))
  }

  replace(i, node) {
    let copy = this.content.slice()
    copy[i] = node
    return new FlatSlice(copy)
  }

  // Assumes slice is same slice type
  appendInner(slice, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = slice.content[0]
    if (joinLeft > 0 && joinRight > 0 && before.sameMarkup(after))
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    for (let i = 1; i < slice.content.length; i++) content.push(slice.content[i])
    return new FlatSlice(content)
  }

  close(depth, side) {
    let off = side == "start" ? 0 : this.size - 1, child = this.content[off]
    let closed = child.close(depth - 1, side)
    return closed == child ? null : this.replace(off, closed)
  }

  between(from, to, onNode, onText, path, parent) {
    let start, endPartial = to && to.depth > path.length
    let end = endPartial ? to.path[path.length] : to ? to.offset : this.size
    if (!from) {
      start = 0
    } else if (from.depth == path.length) {
      start = from.offset
    } else {
      start = from.path[path.length] + 1
      let passTo = null
      if (endPartial && end == start - 1) {
        passTo = to
        endPartial = false
      }
      this.betweenEnter(start - 1, from, passTo, path, onNode, onText, parent)
    }
    for (let i = start; i < end; i++)
      this.betweenEnter(i, null, null, path, onNode, onText, parent)
    if (endPartial)
      this.betweenEnter(end, null, to, path, onNode, onText, parent)
  }

  betweenEnter(index, from, to, path, onNode, onText, parent) {
    path.push(index)
    this.get(index).nodesBetween(from, to, onNode, onText, path, parent)
    path.pop()
  }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.content.length; i++)
      text += this.content[i].textContent
    return text
  }

  toString() {
    return this.content.join(", ")
  }

  toJSON() {
    return this.map(n => n.toJSON())
  }

  static fromJSON(schema, json) {
    if (!json) return emptySlice
    return new FlatSlice(json.map(schema.nodeFromJSON))
  }

  static from(array) {
    return new FlatSlice(array)
  }
}

const emptyArray = []
const emptySlice = new FlatSlice([])

class TextChunk {
  constructor(text, marks) {
    this.text = text
    this.marks = marks
  }
}

export class TextSlice extends Slice {
  constructor(content) {
    super()
    this.content = content
    this.size = 0
    for (let i = 0; i < content.length; i++) {
      let elt = content[i]
      if (elt instanceof TextChunk)
        this.size += elt.text.length
      else
        this.size++
    }
  }

  indexOf(elt, start) { return this.content.indexOf(elt, start || 0) }
  atIndex(i) { return this.content[i] }
  get indexLength() { return this.content.length }

  get(i, parent) {
    if (i < 0 || i >= this.size) throw new Error("Child index " + i + " out of range")
    for (let i = 0, off = 0; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let size = elt.text.length
        if (off + size > i)
          return new Node(parent.type.schema.text,
                          {character: elt.text.charAt(i - off)}, null, elt.marks)
        off += size
      } else {
        if (off == i) return elt
        off++
      }
    }
  }

  nodes(f) {
    for (let i = 0, off = 0; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk)
        off += elt.text.lengthlet end = off + elt.text.length
      else
        f(elt, off++)
    }
  }

  chunkBefore(off) {
    if (!off) throw new Error("No chunk before start of node")
    for (let i = 0, count = off; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let size = elt.text.length
        count -= size
        if (count <= 0) return {text: elt.text, marks: elt.marks, start: off + count}
      } else {
        --count
        if (count == 0) return {node: elt, start: off - 1}
      }
    }
  }
 
  chunkAfter(off) {
    if (i == this.size) throw new Error("No chunk after end of node")
    for (let i = 0, count = off; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let size = elt.text.length
        if (count < size) return {text: elt.text, marks: elt.marks, start: off - count}
        count -= size
      } else {
        if (!count) return {node: elt, start: off}
        --count
      }
    }
  }

  chunks(f) {
    for (let i = 0, off = 0; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let end = off + elt.text.length
        f(null, elt.text, elt.marks, off, end)
        off = end
      } else {
        f(elt, null, elt.marks, off, off + 1)
        ++off
      }
    }
  }

  slice(from, to = this.size) {
    let result = []
    if (from == to) return result
    for (let i = 0, off = 0; off < to; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let size = elt.text.length, end = off + size
        if (end > from)
          result.push(off >= from && end <= to ? elt : new TextChunk(elt.text.slice(Math.max(0, from - offset),
                                                                                    Math.min(size, to - offset)), elt.marks))
        off = end
      } else {
        if (off >= from) result.push(elt)
        off++
      }
    }
    return new TextSlice(result)
  }

  replace(i, node) {
    if (node.type.isText)
      node = new TextChunk(node.attrs.character, node.marks)
    return this.slice(0, i).append(new TextSlice([node])).append(this.slice(i + 1))
  }

  appendInner(slice, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = slice.content[0]
    if (before instanceof TextChunk && after instanceof TextChunk && sameStyles(before.marks, after.marks)) {
      content.push(new TextChunk(before.text + after.text, before.marks))
    } else {
      content.push(before instanceof TextChunk ? before : before.close(joinLeft - 1, "end"),
                   after instanceof TextChunk ? after : after.close(joinRight - 1, "start"))
    }
    for (let i = 1; i < slice.content.length; i++) content.push(slice.content[i])
    return new TextSlice(content)
  }

  close(depth, side) {
    let off = side == "start" ? 0 : this.content.length - 1, child = this.content[off]
    if (child instanceof TextChunk) return null
    let closed = child.close(depth - 1, side)
    if (closed == child) return null
    let copy = this.content.slice()
    copy[off] = closed
    return new TextSlice(copy)
  }

  between(from, to, onNode, onText, path, parent) {
    let moreFrom = from && from.depth > path.length, moreTo = to && to.depth > path.length
    let start = !from ? 0 : moreFrom ? from.path[path.length] : from.offset
    let end = !to ? this.size : moreTo ? to.path[path.length] + 1 : to.offset
    if (start == end) return
    for (let i = 0, off = 0; i < this.content.length && off < end; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) {
        let size = elt.text.length, endOff = off + size
        if (end > start && onText) {
          let chunkStart = Math.max(off, start), chunkEnd = Math.min(endOff, end)
          let text = chunk.text.slice(chunkStart - off, chunkEnd - off)
          onText(text, elt.marks, path, chunkStart, chunkEnd, parent)
        }
        off = end
      } else {
        if (off >= start) {
          path.push(off)
          elt.nodesBetween(moreFrom && off == start ? from, moreTo && off == end - 1, onNode, onText, path, parent)
          path.pop()
        }
        off++
      }
    }
  }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.content.length; i++) {
      let elt = this.content[i]
      if (elt instanceof TextChunk) text += elt.text
      else text += elt.textContent
    }
    return text
  }

  toString() {
    return this.content.map(elt => {
      if (elt instanceof TextChunk) {
        let text = JSON.stringify(elt.text)
        for (let i = 0; i < elt.marks.length; i++)
          text = elt.marks[i].type.name + "(" + text + ")"
        return text
      } else {
        return elt.toString()
      }
    }).join(", ")
  }

  toJSON() {
    return this.content.map(n => {
      if (n instanceof TextChunk) {
        let obj = {text: n.text}
        if (n.marks) obj.marks = n.marks
      } else {
        return n.toJSON()
      }
    })
  }

  static fromJSON(schema, json) {
    if (!json) return emptySlice
    let result = []
    for (let i = 0; i < json.length; i++) {
      let elt = json[i]
      result.push(elt.text ? new TextChunk(elt.text, elt.marks || emptyArray)
                           : Node.fromJSON(schema, n))
    }
    return new TextSlice(result)
  }

  static from(nodes) {
    nodes = nodes.slice()
    let textChunk = null
    for (let i = 0; i < nodes.length; i++) {
      let child = nodes[i]
      if (child.type.isText) {
        if (textChunk && sameStyles(textChunk.marks, child.marks)) {
          textChunk.text += child.attrs.character
          nodes.splice(i--, 1)
        } else {
          textChunk = nodes[i] = new TextChunk(child.attrs.character, child.marks)
        }
      } else {
        textChunk = null
      }
    }
    return new TextSlice(nodes)
  }
}

/**
 * Document node class
 */
export class Node {
  constructor(type, attrs, content, marks) {
    this.type = type
    this.attrs = attrs
    this.content = content || emptySlice
    this.marks = marks || emptyArray
  }

  get size() { return this.content.size }
  get length() { return this.content.size } // FIXME remove
  get maxOffset() { return this.content.size } // FIXME remove

  child(i) { return this.content.get(i) } // FIXME remove
  get(off) { return this.content.get(off, this) }
  chunkBefore(off) { return this.content.chunkBefore(off) }
  chunkAfter(off) { return this.content.chunkAfter(off) }

  chunks(f) { this.content.chunks(f) }
  nodes(f) { this.content.nodes(f) }
  get textContent() { return this.content.textContent }

  get firstChild() { return this.size ? this.get(0) : null }
  get lastChild() { return this.size ? this.get(this.size - 1) : null }

  sameMarkup(other) {
    return compareMarkup(this.type, other.type, this.attrs, other.attrs)
  }

  copy(content = null) {
    return new Node(this.type, this.attrs, content, this.marks)
  }

  mark(marks) {
    return new Node(this.type, this.attrs, this.content, marks)
  }

  // FIXME remove or return a node
  slice(from, to = this.size) {
    return this.content.slice(from, to)
  }

  // FIXME remove? optimize?
  splice(from, to, replace) {
    return this.copy(this.content.slice(0, from).append(replace).concat(this.content.slice(to)))
  }

  append(slice, joinLeft = 0, joinRight = 0) {
    return this.copy(this.content.append(slice, joinLeft, joinRight))
  }

  replace(pos, node) {
    return this.copy(this.content(replace(pos, node)))
  }

  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.child(pos).replaceDeep(path, node, depth + 1))
  }

  close(depth, side) {
    if (depth == 0 && this.size == 0 && !this.type.canBeEmpty)
      return this.copy(this.type.defaultContent())
    let closedContent
    if (depth > 0 && (closedContent = this.content.close(depth - 1, side)))
      return this.copy(closedContent)
    return this
  }

  /**
   * Get a child node given a path.
   *
   * @param  {array} path
   * @return {Node}
   */
  path(path) {
    for (var i = 0, node = this; i < path.length; node = node.get(path[i]), i++) {}
    return node
  }

  pathNodes(path) {
    let nodes = []
    for (var i = 0, node = this;; i++) {
      nodes.push(node)
      if (i == path.length) break
      node = node.get(path[i])
    }
    return nodes
  }

  isValidPos(pos, requireTextblock) {
    for (let i = 0, node = this;; i++) {
      if (i == pos.path.length) {
        if (requireTextblock && !node.isTextblock) return false
        return pos.offset <= node.maxOffset
      } else {
        let n = pos.path[i]
        if (n >= node.size) return false
        node = node.get(n)
      }
    }
  }

  nodesBetween(from, to, onNode, onText, path = [], parent = null) {
    if (onNode && onNode(this, path, from, to, parent) === false) return
    this.content.between(from, to, onNode, onText, path, this)
  }

  inlineMarksBetween(from, to, f) {
    this.nodesBetween(from, to, (node, path, _from, _to, parent, offset) => {
      if (node.isInline)
        f(node.marks, node.type, path, offset, offset + 1, parent)
    }, (_, marks, path, from, to, parent) {
      f(marks, this.type.schema.text, path, from, to, parent) // FIXME clean accessor for text type
    })
  }

  // FIXME remove these? more specific predicates?
  get isBlock() { return this.type.isBlock }
  get isTextblock() { return this.type.isTextblock }
  get isInline() { return this.type.isInline }
  get isText() { return this.type.isText }

  toString() {
    let content = this.content.toString()
    if (this.type.isBlock)
      return this.type.name + (content ? "(" + content + ")" : "")
    else
      return content
  }

  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      return obj
    }
    if (this.size)
      obj.content = this.content.toJSON()
    if (this.marks.length)
      obj.marks = this.marks
    return obj
  }

  static fromJSON(schema, json) {
    let type = schema.nodeType(json.type)
    let content = type.sliceType.fromJSON(schema, json.content)
    return type.create(json.attrs, slice, json.marks && json.marks.map(schema.markFromJSON))
  }
}

function isEmpty(obj) {
  if (obj) for (let _ in obj) return false
  return true
}

// FIXME define whether this is supposed to take checked/built attrs
export function compareMarkup(typeA, typeB, attrsA, attrsB) {
  if (typeA != typeB) return false
  if (isEmpty(attrsA)) return isEmpty(attrsB)
  if (isEmpty(attrsB)) return false
  for (var prop in attrsA)
    if (attrsB[prop] !== attrsA[prop])
      return false
  return true
}

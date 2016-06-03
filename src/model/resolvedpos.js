// ;; The usual way to represent positions in a document is with a
// plain integer. Since those tell you very little about the context
// of that position, you'll often have to 'resolve' a position to get
// the context you need. Objects of this class represent such a
// resolved position, providing various pieces of context information
// and helper methods.
//
// Throughout this interface, methods that take an optional `depth`
// parameter will interpret undefined as `this.depth` and negative
// numbers as `this.depth + value`.
export class ResolvedPos {
  constructor(pos, path, parentOffset) {
    // :: number The position that was resolved.
    this.pos = pos
    this.path = path
    // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root, it is 0. If it points
    // into a top-level paragraph, 1, and so on.
    this.depth = path.length / 3 - 1
    // :: number The offset this position has into its parent node.
    this.parentOffset = parentOffset
  }

  resolveDepth(val) {
    if (val == null) return this.depth
    if (val < 0) return this.depth + val
    return val
  }

  // :: Node
  // The parent node that the position points into. Note that even if
  // a position points into a text node, that node is not considered
  // the parent—text nodes are 'flat' in this model.
  get parent() { return this.node(this.depth) }

  // :: (?number) → Node
  // The ancestor node at the given level. `p.node(p.depth)` is the
  // same as `p.parent`.
  node(depth) { return this.path[this.resolveDepth(depth) * 3] }

  // :: (?number) → number
  // The index into the ancestor at the given level. If this points at
  // the 3rd node in the 2nd paragraph on the top level, for example,
  // `p.index(0)` is 2 and `p.index(1)` is 3.
  index(depth) { return this.path[this.resolveDepth(depth) * 3 + 1] }

  // :: (?number) → number
  // The index pointing after this position into the ancestor at the
  // given level.
  indexAfter(depth) {
    depth = this.resolveDepth(depth)
    return this.index(depth) + (depth == this.depth && this.atNodeBoundary ? 0 : 1)
  }

  // :: (?number) → number
  // The (absolute) position at the start of the node at the given
  // level.
  start(depth) {
    depth = this.resolveDepth(depth)
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1
  }

  // :: (?number) → number
  // The (absolute) position at the end of the node at the given
  // level.
  end(depth) {
    depth = this.resolveDepth(depth)
    return this.start(depth) + this.node(depth).content.size
  }

  // :: (?number) → number
  // The (absolute) position directly before the node at the given
  // level, or, when `level` is `this.level + 1`, the original
  // position.
  before(depth) {
    depth = this.resolveDepth(depth)
    if (!depth) throw new RangeError("There is no position before the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1]
  }

  // :: (?number) → number
  // The (absolute) position directly after the node at the given
  // level, or, when `level` is `this.level + 1`, the original
  // position.
  after(depth) {
    depth = this.resolveDepth(depth)
    if (!depth) throw new RangeError("There is no position after the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize
  }

  // :: bool
  // True if this position points at a node boundary, false if it
  // points into a text node.
  get atNodeBoundary() { return this.path[this.path.length - 1] == this.pos }

  // :: ?Node
  // Get the node directly after the position, if any. If the position
  // points into a text node, only the part of that node after the
  // position is returned.
  get nodeAfter() {
    let parent = this.parent, index = this.index(this.depth)
    if (index == parent.childCount) return null
    let dOff = this.pos - this.path[this.path.length - 1], child = parent.child(index)
    return dOff ? parent.child(index).cut(dOff) : child
  }

  // :: ?Node
  // Get the node directly before the position, if any. If the
  // position points into a text node, only the part of that node
  // before the position is returned.
  get nodeBefore() {
    let index = this.index(this.depth)
    let dOff = this.pos - this.path[this.path.length - 1]
    if (dOff) return this.parent.child(index).cut(0, dOff)
    return index == 0 ? null : this.parent.child(index - 1)
  }

  // :: (ResolvedPos) → number
  // The depth up to which this position and the other share the same
  // parent nodes.
  sameDepth(other) {
    let depth = 0, max = Math.min(this.depth, other.depth)
    while (depth < max && this.index(depth) == other.index(depth)) ++depth
    return depth
  }

  // :: (number, ?(Node) → bool) → ?number
  // Returns the depth, if any, at which this position and the given
  // position diverge around block content. You can pass in an
  // optional predicate that will be called with the node at each
  // level to see if that level is acceptable.
  blockRangeDepth(pos, pred) {
    for (let d = this.depth - (this.parent.isTextblock || this.pos == pos ? 1 : 0); d >= 0; d--)
      if ((pos > this.pos ? pos <= this.end(d) : pos >= this.start(d)) && (!pred || pred(this.node(d))))
        return d
  }

  blockRange(other = this, pred) {
    if (other.pos < this.pos) return other.blockRange(this)
    for (let d = this.depth - (this.parent.isTextblock || this.pos == other.pos ? 1 : 0); d >= 0; d--)
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d))))
        return new NodeRange(this, other, d)
  }

  // :: (ResolvedPos) → bool
  // Query whether the given position shares the same parent node.
  sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset
  }

  toString() {
    let str = ""
    for (let i = 1; i <= this.depth; i++)
      str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1)
    return str + ":" + this.parentOffset
  }

  static resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range")
    let path = []
    let start = 0, parentOffset = pos
    for (let node = doc;;) {
      let {index, offset} = node.content.findIndex(parentOffset)
      let rem = parentOffset - offset
      path.push(node, index, start + offset)
      if (!rem) break
      node = node.child(index)
      if (node.isText) break
      parentOffset = rem - 1
      start += offset + 1
    }
    return new ResolvedPos(pos, path, parentOffset)
  }

  static resolveCached(doc, pos) {
    for (let i = 0; i < resolveCache.length; i++) {
      let cached = resolveCache[i]
      if (cached.pos == pos && cached.node(0) == doc) return cached
    }
    let result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos)
    resolveCachePos = (resolveCachePos + 1) % resolveCacheSize
    return result
  }
}

let resolveCache = [], resolveCachePos = 0, resolveCacheSize = 6

export class NodeRange {
  constructor(from, to, depth) {
    this.from = from
    this.to = to
    this.depth = depth
  }

  get start() { return this.from.before(this.depth + 1) }
  get end() { return this.to.after(this.depth + 1) }

  get parent() { return this.from.node(this.depth) }
  get startIndex() { return this.from.index(this.depth) }
  get endIndex() { return this.to.indexAfter(this.depth) }
}

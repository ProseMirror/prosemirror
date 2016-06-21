const {Fragment} = require("./fragment")
const {Mark} = require("./mark")

class ContentExpr {
  constructor(nodeType, elements, inlineContent) {
    this.nodeType = nodeType
    this.elements = elements
    this.inlineContent = inlineContent
  }

  get isLeaf() {
    return this.elements.length == 0
  }

  start(attrs) {
    return new ContentMatch(this, attrs, 0, 0)
  }

  matches(attrs, fragment, from, to) {
    return this.start(attrs).matchToEnd(fragment, from, to)
  }

  // Get a position in a known-valid fragment. If this is a simple
  // (single-element) expression, we don't have to do any matching,
  // and can simply skip to the position with count `index`.
  getMatchAt(attrs, fragment, index = fragment.childCount) {
    if (this.elements.length == 1)
      return new ContentMatch(this, attrs, 0, index)
    else
      return this.start(attrs).matchFragment(fragment, 0, index)
  }

  checkReplace(attrs, content, from, to, replacement = Fragment.empty, start = 0, end = replacement.childCount) {
    // Check for simple case, where the expression only has a single element
    // (Optimization to avoid matching more than we need)
    if (this.elements.length == 1) {
      let elt = this.elements[0]
      if (!checkCount(elt, content.childCount - (to - from) + (end - start), attrs, this)) return false
      for (let i = start; i < end; i++) if (!elt.matches(replacement.child(i), attrs, this)) return false
      return true
    }

    let match = this.getMatchAt(attrs, content, from).matchFragment(replacement, start, end)
    return match ? match.matchToEnd(content, to) : false
  }

  checkReplaceWith(attrs, content, from, to, type, typeAttrs, marks) {
    if (this.elements.length == 1) {
      let elt = this.elements[0]
      if (!checkCount(elt, content.childCount - (to - from) + 1, attrs, this)) return false
      return elt.matchesType(type, typeAttrs, marks, attrs, this)
    }

    let match = this.getMatchAt(attrs, content, from).matchType(type, typeAttrs, marks)
    return match ? match.matchToEnd(content, to) : false
  }

  compatible(other) {
    for (let i = 0; i < this.elements.length; i++) {
      let elt = this.elements[i]
      for (let j = 0; j < other.elements.length; j++)
        if (other.elements[j].compatible(elt)) return true
    }
    return false
  }

  generateContent(attrs) {
    return this.start(attrs).fillBefore(Fragment.empty, true)
  }

  static parse(nodeType, expr, specs) {
    let elements = [], pos = 0, inline = null
    for (;;) {
      pos += /^\s*/.exec(expr.slice(pos))[0].length
      if (pos == expr.length) break

      let types = /^(?:(\w+)|\(\s*(\w+(?:\s*\|\s*\w+)*)\s*\))/.exec(expr.slice(pos))
      if (!types) throw new SyntaxError("Invalid content expression '" + expr + "' at " + pos)
      pos += types[0].length
      let attrs = /^\[([^\]]+)\]/.exec(expr.slice(pos))
      if (attrs) pos += attrs[0].length
      let marks = /^<(?:(_)|\s*(\w+(?:\s+\w+)*)\s*)>/.exec(expr.slice(pos))
      if (marks) pos += marks[0].length
      let repeat = /^(?:([+*?])|\{\s*(\d+|\.\w+)\s*(,\s*(\d+|\.\w+)?)?\s*\})/.exec(expr.slice(pos))
      if (repeat) pos += repeat[0].length

      let nodeTypes = expandTypes(nodeType.schema, specs, types[1] ? [types[1]] : types[2].split(/\s*\|\s*/))
      for (let i = 0; i < nodeTypes.length; i++) {
        if (inline == null) inline = nodeTypes[i].isInline
        else if (inline != nodeTypes[i].isInline) throw new SyntaxError("Mixing inline and block content in a single node")
      }
      let attrSet = !attrs ? null : parseAttrs(nodeType, attrs[1])
      let markSet = !marks ? false : marks[1] ? true : checkMarks(nodeType.schema, marks[2].split(/\s+/))
      let {min, max} = parseRepeat(nodeType, repeat)
      if (min != 0 && nodeTypes[0].hasRequiredAttrs(attrSet))
        throw new SyntaxError("Node type " + types[0] + " in type " + nodeType.name +
                              " is required, but has non-optional attributes")
      let newElt = new ContentElement(nodeTypes, attrSet, markSet, min, max)
      for (let i = elements.length - 1; i >= 0; i--) {
        let prev = elements[i]
        if (prev.min != prev.max && prev.overlaps(newElt))
          throw new SyntaxError("Possibly ambiguous overlapping adjacent content expressions in '" + expr + "'")
        if (prev.min != 0) break
      }
      elements.push(newElt)
    }

    return new ContentExpr(nodeType, elements, !!inline)
  }
}
exports.ContentExpr = ContentExpr

class ContentElement {
  constructor(nodeTypes, attrs, marks, min, max) {
    this.nodeTypes = nodeTypes
    this.attrs = attrs
    this.marks = marks
    this.min = min
    this.max = max
  }

  matchesType(type, attrs, marks, parentAttrs, parentExpr) {
    if (this.nodeTypes.indexOf(type) == -1) return false
    if (this.attrs) {
      if (!attrs) return false
      for (let prop in this.attrs)
        if (attrs[prop] != resolveValue(this.attrs[prop], parentAttrs, parentExpr)) return false
    }
    if (this.marks === true) return true
    if (this.marks === false) return marks.length == 0
    for (let i = 0; i < marks.length; i++)
      if (this.marks.indexOf(marks[i].type) == -1) return false
    return true
  }

  matches(node, parentAttrs, parentExpr) {
    return this.matchesType(node.type, node.attrs, node.marks, parentAttrs, parentExpr)
  }

  compatible(other) {
    for (let i = 0; i < this.nodeTypes.length; i++)
      if (other.nodeTypes.indexOf(this.nodeTypes[i]) != -1) return true
    return false
  }

  constrainedAttrs(parentAttrs, expr) {
    if (!this.attrs) return null
    let attrs = Object.create(null)
    for (let prop in this.attrs)
      attrs[prop] = resolveValue(this.attrs[prop], parentAttrs, expr)
    return attrs
  }

  createFiller(parentAttrs, expr) {
    let type = this.nodeTypes[0], attrs = type.computeAttrs(this.constrainedAttrs(parentAttrs, expr))
    return type.create(attrs, type.contentExpr.generateContent(attrs))
  }

  defaultType() {
    return this.nodeTypes[0].defaultAttrs && this.nodeTypes[0]
  }

  overlaps(other) {
    return this.nodeTypes.some(t => other.nodeTypes.indexOf(t) > -1)
  }

  allowsMark(markType) {
    return this.marks === true || this.marks && this.marks.indexOf(markType) > -1
  }
}

// ;; Represents a partial match of a node type's [content
// expression](#NodeSpec), and can be used to find out whether further
// content matches here, and whether a given position is a valid end
// of the parent node.
class ContentMatch {
  constructor(expr, attrs, index, count) {
    this.expr = expr
    this.attrs = attrs
    this.index = index
    this.count = count
  }

  get element() { return this.expr.elements[this.index] }

  get nextElement() {
    for (let i = this.index, count = this.count; i < this.expr.elements.length; i++) {
      let element = this.expr.elements[i]
      if (this.resolveValue(element.max) > count) return element
      count = 0
    }
  }

  move(index, count) {
    return new ContentMatch(this.expr, this.attrs, index, count)
  }

  resolveValue(value) {
    return value instanceof AttrValue ? resolveValue(value, this.attrs, this.expr) : value
  }

  // :: (Node) → ?ContentMatch
  // Match a node, returning a new match after the node if successful.
  matchNode(node) {
    return this.matchType(node.type, node.attrs, node.marks)
  }

  // :: (NodeType, ?Object, [Mark]) → ?ContentMatch
  // Match a node type and marks, returning an match after that node
  // if successful.
  matchType(type, attrs, marks = Mark.none) {
    // FIXME `var` to work around Babel bug T7293
    for (var {index, count} = this; index < this.expr.elements.length; index++, count = 0) {
      let elt = this.expr.elements[index], max = this.resolveValue(elt.max)
      if (count < max && elt.matchesType(type, attrs, marks, this.attrs, this.expr)) {
        count++
        return this.move(index, count)
      }
      if (count < this.resolveValue(elt.min)) return null
    }
  }

  // :: (Fragment, ?number, ?number) → ?union<ContentMatch, bool>
  // Try to match a fragment. Returns a new match when successful,
  // `null` when it ran into a required element it couldn't fit, and
  // `false` if it reached the end of the expression without
  // matching all nodes.
  matchFragment(fragment, from = 0, to = fragment.childCount) {
    if (from == to) return this
    let fragPos = from, end = this.expr.elements.length
    for (var {index, count} = this; index < end; index++, count = 0) {
      let elt = this.expr.elements[index], max = this.resolveValue(elt.max)

      while (count < max) {
        if (elt.matches(fragment.child(fragPos), this.attrs, this.expr)) {
          count++
          if (++fragPos == to) return this.move(index, count)
        } else {
          break
        }
      }
      if (count < this.resolveValue(elt.min)) return null
    }
    return false
  }

  // :: (Fragment, ?number, ?number) → bool
  // Returns true only if the fragment matches here, and reaches all
  // the way to the end of the content expression.
  matchToEnd(fragment, start, end) {
    let matched = this.matchFragment(fragment, start, end)
    return matched && matched.validEnd() || false
  }

  // :: () → bool
  // Returns true if this position represents a valid end of the
  // expression (no required content follows after it).
  validEnd() {
    for (let i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0)
      if (count < this.resolveValue(this.expr.elements[i].min)) return false
    return true
  }

  // :: (Fragment, bool, ?number) → ?Fragment
  // Try to match the given fragment, and if that fails, see if it can
  // be made to match by inserting nodes in front of it. When
  // successful, return a fragment of inserted nodes (which may be
  // empty if nothing had to be inserted). When `toEnd` is true, only
  // return a fragment if the resulting match goes to the end of the
  // content expression.
  fillBefore(after, toEnd, startIndex) {
    let added = [], match = this, index = startIndex || 0, end = this.expr.elements.length
    for (;;) {
      let fits = match.matchFragment(after, index)
      if (fits && (!toEnd || fits.validEnd())) return Fragment.from(added)
      if (fits === false) return null // Matched to end with content remaining

      let elt = match.element
      if (match.count < this.resolveValue(elt.min)) {
        added.push(elt.createFiller(this.attrs, this.expr))
        match = match.move(match.index, match.count + 1)
      } else if (match.index < end) {
        match = match.move(match.index + 1, 0)
      } else if (after.childCount > index) {
        return null
      } else {
        return Fragment.from(added)
      }
    }
  }

  possibleContent() {
    let found = []
    for (let i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0) {
      let elt = this.expr.elements[i], attrs = elt.constrainedAttrs(this.attrs, this.expr)
      if (count < this.resolveValue(elt.max)) for (let j = 0; j < elt.nodeTypes.length; j++) {
        let type = elt.nodeTypes[j]
        if (!type.hasRequiredAttrs(attrs)) found.push({type, attrs})
      }
      if (this.resolveValue(elt.min) > count) break
    }
    return found
  }

  // :: (MarkType) → bool
  // Check whether a node with the given mark type is allowed after
  // this position.
  allowsMark(markType) {
    return this.element.allowsMark(markType)
  }

  // :: (NodeType, ?Object) → ?[{type: NodeType, attrs: Object}]
  // Find a set of wrapping node types that would allow a node of type
  // `target` with attributes `targetAttrs` to appear at this
  // position. The result may be empty (when it fits directly) and
  // will be null when no such wrapping exists.
  findWrapping(target, targetAttrs) {
    // FIXME find out how expensive this is. Try to reintroduce caching?
    let seen = Object.create(null), first = {match: this, via: null}, active = [first]
    while (active.length) {
      let current = active.shift(), match = current.match
      if (match.matchType(target, targetAttrs)) {
        let result = []
        for (let obj = current; obj != first; obj = obj.via)
          result.push({type: obj.match.expr.nodeType, attrs: obj.match.attrs})
        return result.reverse()
      }
      let possible = match.possibleContent()
      for (let i = 0; i < possible.length; i++) {
        let {type, attrs} = possible[i], fullAttrs = type.computeAttrs(attrs)
        if (!type.isLeaf && !(type.name in seen) &&
            (current == first || match.matchType(type, fullAttrs).validEnd())) {
          active.push({match: type.contentExpr.start(fullAttrs), via: current})
          seen[type.name] = true
        }
      }
    }
  }
}
exports.ContentMatch = ContentMatch

class AttrValue {
  constructor(attr) { this.attr = attr }
}

function parseValue(nodeType, value) {
  if (value.charAt(0) == ".") {
    let attr = value.slice(1)
    if (!nodeType.attrs[attr]) throw new SyntaxError("Node type " + nodeType.name + " has no attribute " + attr)
    return new AttrValue(attr)
  } else {
    return JSON.parse(value)
  }
}

function checkMarks(schema, marks) {
  let found = []
  for (let i = 0; i < marks.length; i++) {
    let mark = schema.marks[marks[i]]
    if (mark) found.push(mark)
    else throw new SyntaxError("Unknown mark type: '" + marks[i] + "'")
  }
  return found
}

function resolveValue(value, attrs, expr) {
  if (!(value instanceof AttrValue)) return value
  let attrVal = attrs && attrs[value.attr]
  return attrVal !== undefined ? attrVal : expr.nodeType.defaultAttrs[value.attr]
}

function checkCount(elt, count, attrs, expr) {
  return count >= resolveValue(elt.min, attrs, expr) &&
    count <= resolveValue(elt.max, attrs, expr)
}

function expandTypes(schema, specs, types) {
  let result = []
  types.forEach(type => {
    let found = schema.nodes[type]
    if (found) {
      if (result.indexOf(found) == -1) result.push(found)
    } else {
      specs.forEach((name, spec) => {
        if (spec.group && spec.group.split(" ").indexOf(type) > -1) {
          found = schema.nodes[name]
          if (result.indexOf(found) == -1) result.push(found)
        }
      })
    }
    if (!found)
      throw new SyntaxError("Node type or group '" + type + "' does not exist")
  })
  return result
}

const many = 2e9 // Big number representable as a 32-bit int

function parseRepeat(nodeType, match) {
  let min = 1, max = 1
  if (match) {
    if (match[1] == "+") {
      max = many
    } else if (match[1] == "*") {
      min = 0
      max = many
    } else if (match[1] == "?") {
      min = 0
    } else if (match[2]) {
      min = parseValue(nodeType, match[2])
      if (match[3])
        max = match[4] ? parseValue(nodeType, match[4]) : many
      else
        max = min
    }
    if (max == 0 || min > max)
      throw new SyntaxError("Invalid repeat count in '" + match[0] + "'")
  }
  return {min, max}
}

function parseAttrs(nodeType, expr) {
  let parts = expr.split(/\s*,\s*/)
  let attrs = Object.create(null)
  for (let i = 0; i < parts.length; i++) {
    let match = /^(\w+)=(\w+|\"(?:\\.|[^\\])*\"|\.\w+)$/.exec(parts[i])
    if (!match) throw new SyntaxError("Invalid attribute syntax: " + parts[i])
    attrs[match[1]] = parseValue(nodeType, match[2])
  }
  return attrs
}

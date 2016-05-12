import {Fragment} from "./fragment"

const many = 2e9 // Big number representable as a 32-bit int

export class ContentExpr {
  constructor(nodeType, elements) {
    this.nodeType = nodeType
    this.elements = elements
  }

  get isLeaf() {
    return this.elements.length == 0
  }

  start(attrs) {
    return new ContentMatch(this, attrs, 0, 0)
  }

  end(attrs) {
    return new ContentMatch(this, attrs, this.elements.length, 0)
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
      for (let i = start; i < end; i++) if (!elt.matches(replacement.child(i))) return false
      return true
    }

    let match = this.getMatchAt(attrs, content, from).matchFragment(replacement, start, end)
    return match ? match.matchToEnd(content, to) : false
  }

  checkReplaceWith(attrs, content, from, to, type, marks) {
    if (this.elements.length == 1) {
      let elt = this.elements[0]
      if (!checkCount(elt, content.childCount - (to - from) + 1, attrs, this)) return false
      return elt.matchesType(type, marks)
    }

    let match = this.getMatchAt(attrs, content, from).matchType(type, marks)
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

  containsOnly(node) {
    return this.elements.length == 1 && this.elements[0].matches(node)
  }

  generateContent(attrs) {
    return this.start(attrs).fillBefore(Fragment.empty, true)
  }

  static parse(nodeType, expr, groups) {
    let elements = [], pos = 0
    for (;;) {
      pos += /^\s*/.exec(expr.slice(pos))[0].length
      if (pos == expr.length) break

      let types = /^(?:(\w+)|\(\s*(\w+(?:\s*\|\s*\w+)*)\s*\))/.exec(expr.slice(pos))
      if (!types) throw new SyntaxError("Invalid content expression '" + expr + "' at " + pos)
      pos += types[0].length
      let marks = /^\[(?:(_)|\s*(\w+(?:\s+\w+)*)\s*)\]/.exec(expr.slice(pos))
      if (marks) pos += marks[0].length
      let count = /^(?:([+*?])|%(\d+|@\w+)|\{\s*(\d+|@\w+)\s*(,\s*(\d+|@\w+)?)?\s*\})/.exec(expr.slice(pos))
      if (count) pos += count[0].length

      let nodeTypes = expandTypes(nodeType.schema, groups, types[1] ? [types[1]] : types[2].split(/\s*\|\s*/))
      let markSet = !marks ? false : marks[1] ? true : checkMarks(nodeType.schema, marks[2].split(/\s+/))
      let min = 1, max = 1, mod = -1
      if (count) {
        if (count[1] == "+") {
          max = many
        } else if (count[1] == "*") {
          min = 0
          max = many
        } else if (count[1] == "?") {
          min = 0
        } else if (count[2]) {
          max = many
          min = mod = parseCount(nodeType, count[2])
        } else if (count[3]) {
          min = parseCount(nodeType, count[3])
          if (count[4])
            max = count[5] ? parseCount(nodeType, count[5]) : many
          else
            max = min
        }
        if (max == 0 || mod == 0 || min > max)
          throw new SyntaxError("Invalid repeat count in '" + expr + "'")
      }
      if (min != 0 && nodeTypes[0].hasRequiredAttrs)
        throw new SyntaxError("Node type " + types[0] + " in type " + nodeType.name +
                              " is required, but has non-optional attributes")
      let newElt = new ContentElement(nodeTypes, markSet, min, max, mod)
      for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].overlaps(newElt))
          throw new SyntaxError("Overlapping adjacent content expressions in '" + expr + "'")
        if (elements[i].min != 0) break
      }
      elements.push(newElt)
    }
    return new ContentExpr(nodeType, elements)
  }
}

class ContentElement {
  constructor(nodeTypes, marks, min, max, mod) {
    this.nodeTypes = nodeTypes
    this.marks = marks
    this.min = min
    this.max = max
    this.mod = mod
  }

  matchesType(type, marks) {
    if (this.nodeTypes.indexOf(type) == -1) return false
    if (this.marks === true) return true
    if (this.marks === false) return marks.length == 0
    for (let i = 0; i < marks.length; i++)
      if (this.marks.indexOf(marks[i].type) == -1) return false
    return true
  }

  matches(node) {
    return this.matchesType(node.type, node.marks)
  }

  compatible(other) {
    for (let i = 0; i < this.nodeTypes.length; i++)
      if (other.nodeTypes.indexOf(this.nodeTypes[i]) != -1) return true
    return false
  }

  createFiller() {
    let type = this.nodeTypes[0], attrs = type.computeAttrs(null)
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
// expression](#SchemaSpec.nodes).
export class ContentMatch {
  constructor(expr, attrs, index, count) {
    this.expr = expr
    this.attrs = attrs
    this.index = index
    this.count = count
  }

  get element() { return this.expr.elements[this.index] }

  move(index, count) {
    return new ContentMatch(this.expr, this.attrs, index, count)
  }

  resolveCount(count) {
    return typeof count == "number" ? count : resolveCount(count, this.attrs, this.expr)
  }

  validCount(elt, count) {
    let min = this.resolveCount(elt.min), mod = this.resolveCount(elt.mod)
    return count >= min && (mod == -1 || count % mod == 0)
  }

  nextValidCount(elt, count) {
    let mod = this.resolveCount(elt.mod)
    let valid = mod == -1 ? Math.max(this.resolveCount(elt.min), count) : count < mod ? mod : count + mod - (count % mod)
    return valid > this.resolveCount(elt.max) ? -1 : valid
  }

  // :: (Node) → ?ContentMatch
  // Match a node, returning an updated match if successful.
  matchNode(node) {
    return this.matchType(node.type, node.marks)
  }

  // :: (NodeType, [Mark]) → ?ContentMatch
  // Match a node type and marks, returning an updated match if
  // successful.
  matchType(type, marks) {
    // FIXME `var` to work around Babel bug T7293
    for (var {index, count} = this; index < this.expr.elements.length; index++, count = 0) {
      let elt = this.expr.elements[index], max = this.resolveCount(elt.max)
      if (count < max && elt.matchesType(type, marks)) {
        count++
        return this.move(index, count)
      }
      if (!this.validCount(elt, count)) return null
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
      let elt = this.expr.elements[index], max = this.resolveCount(elt.max)

      while (count < max) {
        if (elt.matches(fragment.child(fragPos))) {
          count++
          if (++fragPos == to) return this.move(index, count)
        } else {
          break
        }
      }
      if (!this.validCount(elt, count)) return null
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
    for (let i = this.index; i < this.expr.elements.length; i++)
      if (!this.validCount(this.expr.elements[i], i == this.index ? this.count : 0)) return false
    return true
  }

  // :: (Fragment, bool, ?number) → ?Fragment
  // Try to match the given fragment, and if that fails, see if it can
  // be made to match by inserting nodes in front of it. When
  // successful, return a fragment (which may be empty if nothing had
  // to be inserted). When `toEnd` is true, only return a fragment if
  // the resulting match goes to the end of the content expression.
  fillBefore(after, toEnd, startIndex) {
    let added = [], match = this, index = startIndex || 0, end = this.expr.elements.length
    for (;;) {
      let fits = match.matchFragment(after, index)
      if (fits && (!toEnd || fits.validEnd())) break
      if (fits === false) return null // Matched to end with content remaining

      // If that fails, move to the next content element, adding
      // filler elements if necessary.
      let elt = match.element, ahead = 0, fill
      while (index + ahead < after.childCount && elt.matches(after.child(index + ahead))) ++ahead

      if (ahead) {
        let nextValid = this.nextValidCount(elt, match.count + ahead)
        if (nextValid > -1) fill = nextValid - match.count - ahead
      }
      if (fill == null) fill = this.nextValidCount(elt, match.count) - match.count
      if (fill > 0) {
        for (let i = 0; i < fill; i++) added.push(elt.createFiller())
        match = match.move(match.index, match.count + fill)
      } else if (match.index == end) {
        if (after.size) return null
        else break
      } else {
        match = match.move(match.index + 1, 0)
      }
    }
    return Fragment.from(added)
  }

  possibleTypes() {
    let found = []
    for (let i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0) {
      let elt = this.expr.elements[i]
      if (count < this.resolveCount(elt.max))
        found = found.concat(elt.nodeTypes)
      if (this.resolveCount(elt.min) > count) break
    }
    return found
  }

  // :: (MarkType) → bool
  // Check whether a node with the given mark type is allowed after
  // this position.
  allowsMark(markType) {
    return this.element.allowsMark(markType)
  }
}

function parseCount(nodeType, count) {
  if (count.charAt(0) == "@") {
    let attr = count.slice(1)
    if (!nodeType.attrs[attr]) throw new SyntaxError("Node type " + nodeType.name + " has no attribute " + attr)
    return attr
  } else {
    return Number(count)
  }
}

function resolveCount(count, attrs, expr) {
  if (typeof count == "number") return count
  if (attrs) {
    let value = attrs[count]
    if (value !== undefined) return +value
  }
  return +expr.nodeType.defaultAttrs[count].default
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

function checkCount(elt, count, attrs, expr) {
  if (count < resolveCount(elt.min, attrs, expr) ||
      count > resolveCount(elt.max, attrs, expr)) return false
  let mod = resolveCount(elt.mod, attrs, expr)
  return mod == -1 || (count % mod == 0)
}

function expandTypes(schema, groups, types) {
  let result = []
  function expand(type) {
    let found
    if (found = schema.nodes[type])
      result.indexOf(found) == -1 && result.push(found)
    else if ((found = groups[type]) && found.length)
      found.forEach(expand)
    else
      throw new SyntaxError("Node type or group '" + type + "' does not exist")
  }
  types.forEach(expand)
  return result
}

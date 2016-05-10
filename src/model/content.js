import {Fragment} from "./fragment"

const many = 1e8

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

  matches(attrs, fragment) {
    let end = this.start(attrs).matchFragment(fragment)
    return end ? end.validEnd() : false
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

  checkUpdate(attrs, content, from, to, replacement = Fragment.empty, start = 0, end = replacement.childCount) {
    // Check for simple case, where the expression only has a single element
    // (Optimization to avoid matching more than we need)
    if (this.elements.length == 1) {
      let elt = this.elements[0]
      if (!checkCount(elt, content.childCount - (to - from) + (end - start), attrs, this)) return false
      for (let i = start; i < end; i++) if (!elt.matches(replacement.child(i))) return false
      return true
    }

    let match = this.getMatchAt(attrs, content, from).matchFragment(replacement, start, end)
    match = match && match.matchFragment(content, to)
    return match && match.validEnd()
  }

  checkUpdateWithType(attrs, content, from, to, type, marks) {
    if (this.elements.length == 1) {
      let elt = this.elements[0]
      if (!checkCount(elt, content.childCount - (to - from) + 1, attrs, this)) return false
      return elt.matchesType(type, marks)
    }

    let match = this.getMatchAt(attrs, content, from).matchType(type, marks)
    match = match && match.matchFragment(content, to)
    return match && match.validEnd()
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

  static parse(nodeType, expr) {
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

      let nodeTypes = expandTypes(nodeType.schema, types[1] ? [types[1]] : types[2].split(/\s*\|\s*/))
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

  overlaps(other) {
    return this.nodeTypes.some(t => other.nodeTypes.indexOf(t) > -1)
  }

  allowsMark(markType) {
    return this.marks === true || this.marks && this.marks.indexOf(markType) > -1
  }
}

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

  matchNode(node) {
    return this.matchType(node.type, node.marks)
  }

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

  // : (Fragment, ?number, ?number) → ?union<MatchPos, bool>
  // Try to match a fragment. Returns a new position when successful,
  // false when it ran into a required element it couldn't fit, and
  // undefined if it reached the end of the expression without
  // matching all nodes.
  matchFragment(fragment, startFragPos = 0, endFragPos = fragment.childCount) {
    if (startFragPos == endFragPos) return this
    let fragPos = startFragPos, end = this.expr.elements.length
    for (var {index, count} = this; index < end; index++, count = 0) {
      let elt = this.expr.elements[index], max = this.resolveCount(elt.max)

      while (count < max) {
        if (elt.matches(fragment.child(fragPos))) {
          count++
          if (++fragPos == endFragPos) return this.move(index, count)
        } else {
          break
        }
      }
      if (!this.validCount(elt, count)) return false
    }
  }

  matchOnCurrentElement(fragment, startIndex) {
    let matched = startIndex, elt = this.element
    while (matched < fragment.childCount && elt.matches(fragment.child(matched))) ++matched
    return matched - startIndex
  }

  validEnd() {
    for (let i = this.index; i < this.expr.elements.length; i++)
      if (!this.validCount(this.expr.elements[i], i == this.index ? this.count : 0)) return false
    return true
  }

  moveForward(target, extraCount) {
    let elt = this.element
    if (this.validCount(elt, this.count + extraCount)) return this.move(this.index + 1, 0)
    target.push(elt.createFiller())
    return this.move(this.index, this.count + 1)
  }

  // FIXME make sure this algorithm is actually solid
  fillBefore(after, toEnd, startIndex) {
    let added = [], front = this, index = startIndex || 0
    for (;;) {
      let fits = front.matchFragment(after, index)
      if (fits && (!toEnd || fits.validEnd())) return Fragment.from(added)
      if (fits === undefined) return null
      front = front.moveForward(added, front.matchOnCurrentElement(after, index))
    }
  }

  possibleTypes() {
    let found = []
    for (let i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0) {
      let elt = this.expr.elements[i]
      if (count < this.resolveCount(elt.max))
        found = found.concat(elt.nodeTypes)
      if (this.resolveCount(elt.min) <= count)
        break
    }
    return found
  }

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
  return +expr.nodeType.attrs[count].default
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

function expandTypes(schema, types) {
  let found = []
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (schema.nodes[type]) {
      found.push(schema.nodes[type])
    } else {
      let startLen = found.length, sawDefault = false
      for (let name in schema.nodes) if (schema.nodes[name].group == type) {
        let type = schema.nodes[name]
        if (type.groupDefault) {
          if (sawDefault) throw new SyntaxError("Multiple default types in group " + type)
          sawDefault = true
          found.splice(startLen, 0, type)
        } else {
          found.push(type)
        }
      }
      if (found.length == startLen)
        throw new SyntaxError("Node type or group '" + type + "' does not exist")
    }
  }
  return found
}

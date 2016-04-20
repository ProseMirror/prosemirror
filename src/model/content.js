import {Fragment} from "./fragment"

const many = 1e8

export class ContentExpr {
  constructor(elements) {
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
  getMatchAt(attrs, fragment, index) {
    if (this.elements.length == 1)
      return new ContentMatch(this, attrs, 0, index)
    else
      return this.start(attrs).matchFragment(fragment, 0, index)
  }

  canInsert(attrs, fragment, index, type, marks) {
    let match = this.getMatchAt(attrs, fragment, index), elt = match.element
    if (match.resolveCount(elt.max) == many && elt.matchesType(type, marks)) return true
    if (!(match = match.matchType(type, marks))) return false
    return !!match.matchFragment(fragment, index)
  }

  appendableTo(other) {
    if (other.isLeaf || this.isLeaf) return false
    return this.elements[this.elements.length - 1].subElement(other.elements[other.elements.length - 1])
  }

  containsOnly(node) {
    return this.elements.length == 1 && this.elements[0].matches(node)
  }

  fillContent(attrs, before, mid, after) {
    let back = this.end(attrs).matchFragmentBackward(after)
    let front = back && this.start(attrs).matchFragment(before, undefined, undefined, back)
    if (!front) return null
    let left = [], right
    for (;;) {
      let fits = front.matchFragment(mid, undefined, undefined, back)
      if (fits && (right = fits.fillTo(back)))
        return {left: Fragment.from(left), right: Fragment.from(right)}
      if (front.index == back.index - 1) return null
      front = front.fillOne(left)
      if (!front) return null
    }
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
      let newElt = new ContentElement(nodeTypes, markSet, min, max, mod)
      for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].overlaps(newElt))
          throw new SyntaxError("Overlapping adjacent content expressions in '" + expr + "'")
        if (elements[i].min != 0) break
      }
      elements.push(newElt)
    }
    return new ContentExpr(elements)
  }
}

// FIXME automatically fill when a node doesn't fit?
// FIXME remove, have from_dom directly use ContentMatch
export class NodeBuilder {
  constructor(type, attrs) {
    this.type = type
    this.pos = type.contentExpr.start(attrs)
    this.content = []
  }

  add(node) {
    let matched = this.pos.matchNode(node)
    if (!matched) return false
    this.content.push(node)
    this.pos = matched
    return true
  }

  finish() {
    let fill = this.pos.fillTo(this.pos.expr.end(this.pos.attrs))
    if (!fill) return null
    return this.type.create(this.pos.attrs, this.content.concat(fill))
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

  subElement(other) {
    for (let i = 0; i < this.nodeTypes.length; i++)
      if (other.nodeTypes.indexOf(this.nodeTypes[i]) == -1) return false
    if (other.marks == true || this.marks == false) return true
    if (other.marks == false || this.marks == true) return false
    for (let i = 0; i < this.marks.length; i++)
      if (other.marks.indexOf(this.marks[i]) == -1) return false
    return true
  }

  createFiller() {
    for (let i = 0; i < this.nodeTypes.length; i++) {
      let type = this.nodeTypes[i]
      if (type.defaultAttrs && !type.isText)
        return type.create(null, type.fixContent(null, type.defaultAttrs)) // FIXME saner interface for creating default content
    }
  }

  overlaps(other) {
    return this.nodeTypes.some(t => other.nodeTypes.indexOf(t) > -1)
  }

  allowsMark(markType) {
    return this.marks === true || this.marks && this.marks.indexOf(markType) > -1
  }
}

class ContentMatch {
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
    if (typeof count == "number") return count
    return +this.attrs[count]
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

  matchFragment(fragment, startFragPos = 0, endFragPos = fragment.childCount, maxPos) {
    if (startFragPos == endFragPos) return this
    let fragPos = startFragPos, end = maxPos ? maxPos.index : this.expr.elements.length
    for (var {index, count} = this; index < end; index++, count = 0) {
      let elt = this.expr.elements[index], max = this.resolveCount(elt.max)
      if (maxPos && index == end - 1) max -= maxPos.count

      while (count < max) {
        if (elt.matches(fragment.child(fragPos))) {
          count++
          if (++fragPos == endFragPos) return this.move(index, count)
        } else {
          break
        }
      }
      if (!this.validCount(elt, count)) return null
    }
  }

  matchFragmentBackward(fragment) {
    let fragPos = fragment.childCount
    if (fragPos == 0) return this
    for (var {index, count} = this; index > 0; index--, count = 0) {
      let elt = this.expr.elements[index - 1], max = this.resolveCount(elt.max)
      while (count < max) {
        if (elt.matches(fragment.child(fragPos - 1))) {
          count++
          if (--fragPos == 0) return this.move(index, count)
        } else {
          break
        }
      }
      if (!this.validCount(elt, count)) return null
    }
  }

  validEnd() {
    for (let i = this.index; i < this.expr.elements.length; i++)
      if (!this.validCount(this.expr.elements[i], i == this.index ? this.count : 0)) return false
    return true
  }

  fillOne(target, extraCount = 0) {
    let elt = this.element, count = this.count
    while (!this.validCount(elt, count + extraCount)) {
      let node = elt.createFiller()
      if (!node) return null
      target.push(node)
      count++
    }
    return this.move(this.index + 1, 0)
  }

  fillTo(end) {
    let found = [], pos = this
    while (pos.index < end.index) {
      pos = pos.fillOne(found, pos.index == end.index - 1 ? end.count : 0)
      if (!pos) return null
    }
    return found
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

function checkMarks(schema, marks) {
  let found = []
  for (let i = 0; i < marks.length; i++) {
    let mark = schema.marks[marks[i]]
    if (mark) found.push(mark)
    else throw new SyntaxError("Unknown mark type: '" + marks[i] + "'")
  }
  return found
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

import {Fragment} from "./fragment"

export class ContentExpr {
  constructor(elements) {
    this.elements = elements
  }

  get isLeaf() {
    return this.elements.length == 0
  }

  matchOne(attrs, node, startPos) {
    // FIXME `var` to work around Babel bug T7293
    for (var {index, count} = startPos; index < this.elements.length; index++, count = 0) {
      let elt = this.elements[index], max = resolveCount(elt.max, attrs)
      if (count < max && elt.matches(node)) {
        count++
        return new MatchPos(index, count)
      }
      if (!elt.validCount(attrs, count)) return null
    }
  }

  matchForward(attrs, fragment, startPos, maxPos) {
    if (!fragment.childCount) return startPos
    let fragPos = 0, end = maxPos ? maxPos.index : this.elements.length
    for (var {index, count} = startPos; index < end; index++, count = 0) {
      let elt = this.elements[index], max = resolveCount(elt.max, attrs)
      if (maxPos && index == end - 1) max -= maxPos.count

      while (count < max) {
        if (elt.matches(fragment.child(fragPos))) {
          count++
          if (++fragPos == fragment.childCount) return new MatchPos(index, count)
        } else {
          break
        }
      }
      if (!elt.validCount(attrs, count)) return null
    }
  }

  matchBackward(attrs, fragment, startPos) {
    let fragPos = fragment.childCount
    if (fragPos == 0) return startPos
    for (var {index, count} = startPos; index > 0; index--, count = 0) {
      let elt = this.elements[index - 1], max = resolveCount(elt.max, attrs)
      while (count < max) {
        if (elt.matches(fragment.child(fragPos - 1))) {
          count++
          if (--fragPos == 0) return new MatchPos(index, count)
        } else {
          break
        }
      }
      if (!elt.validCount(attrs, count)) return null
    }
  }

  matches(attrs, fragment) {
    let pos = this.matchForward(attrs, fragment, new MatchPos(0, 0))
    if (!pos) return false
    for (let i = pos.index; i < this.elements.length; i++)
      if (!this.elements[i].validCount(attrs, i == pos.index ? pos.count : 0)) return false
    return true
  }

  appendableTo(other) {
    if (other.isLeaf || this.isLeaf) return false
    return this.elements[this.elements.length - 1].subElement(other.elements[other.elements.length - 1])
  }

  containsOnly(node) {
    return this.elements.length == 1 && this.elements[0].matches(node)
  }

  fillTwoWay(attrs, before, after) {
    let back = this.matchBackward(attrs, after, new MatchPos(this.elements.length, 0))
    let front = back && this.matchForward(attrs, before, new MatchPos(0, 0), back)
    let result = front && this.fillTo(attrs, front, back)
    return result ? Fragment.from(result) : null
  }

  fillThreeWay(attrs, before, mid, after) {
    let back = this.matchBackward(attrs, after, new MatchPos(this.elements.length, 0))
    let front = back && this.matchForward(attrs, before, new MatchPos(0, 0), back)
    if (!front) return null
    let left = [], right
    for (;;) {
      let fits = this.matchForward(attrs, mid, front, back)
      if (fits && (right = this.fillTo(attrs, fits, back)))
        return {left: Fragment.from(left), right: Fragment.from(right)}
      if (front.index == back.index - 1) return null
      if (!this.fillOne(attrs, front, left)) return null
    }
  }

  fillOne(attrs, pos, target, extraCount = 0) {
    let elt = this.elements[pos.index]
    while (!elt.validCount(attrs, pos.count + extraCount)) {
      let node = elt.createFiller()
      if (!node) return false
      target.push(node)
      pos.count++
    }
    pos.index++
    pos.count = 0
    return true
  }

  fillTo(attrs, startPos, end) {
    if (!end) end = new MatchPos(this.elements.length, 0)
    let found = [], pos = new MatchPos(startPos.index, startPos.count)
    while (pos.index < end.index)
      if (!this.fillOne(attrs, pos, found, pos.index == end.index - 1 ? end.count : 0)) return null
    return found
  }

  possibleTypes(attrs, pos = new MatchPos(0, 0)) {
    let found = []
    for (let i = pos.index, count = pos.count; i < this.elements.length; i++, count = 0) {
      let elt = this.elements[i]
      if (count < resolveCount(elt.max, attrs))
        found = found.concat(elt.nodeTypes)
      if (resolveCount(elt.min, attrs) <= count)
        break
    }
    return found
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
          max = 1e8
        } else if (count[1] == "*") {
          min = 0
          max = 1e8
        } else if (count[1] == "?") {
          min = 0
        } else if (count[2]) {
          max = 1e8
          min = mod = parseCount(nodeType, count[2])
        } else if (count[3]) {
          min = parseCount(nodeType, count[3])
          if (count[4])
            max = count[5] ? parseCount(nodeType, count[5]) : 1e8
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
export class NodeBuilder {
  constructor(type, attrs) {
    this.type = type
    this.attrs = attrs
    this.pos = new MatchPos(0, 0)
    this.content = []
  }

  add(node) {
    let matched = this.type.contentExpr.matchOne(this.attrs, node, this.pos)
    if (!matched) return false
    this.content.push(node)
    this.pos = matched
    return true
  }

  finish() {
    let fill = this.type.contentExpr.fillTo(this.attrs, this.pos)
    if (!fill) return null
    return this.type.create(this.attrs, this.content.concat(fill))
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

  matches(node) {
    if (this.nodeTypes.indexOf(node.type) == -1) return false
    if (this.marks === true) return true
    if (this.marks === false) return node.marks.length == 0
    for (let i = 0; i < node.marks.length; i++)
      if (this.marks.indexOf(node.marks[i].type) == -1) return false
    return true
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

  validCount(attrs, count) {
    let min = resolveCount(this.min, attrs), mod = resolveCount(this.mod, attrs)
    return count >= min && (mod == -1 || count % mod == 0)
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
}

class MatchPos {
  constructor(index, count) {
    this.index = index
    this.count = count
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

function resolveCount(count, attrs) {
  if (typeof count == "number") return count
  return +attrs[count]
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

import {Fragment} from "./fragment"

export class ContentExpr {
  constructor(elements) {
    this.elements = elements
  }

  get isLeaf() {
    return this.elements.length == 0
  }

  matchForward(attrs, fragment, pos, maxPos) {
    let fragPos = 0, end = maxPos ? maxPos.index : this.elements.length
    if (fragPos == fragment.childCount) return pos
    for (;;) {
      if (pos.index == end) return null
      let elt = this.elements[pos.index], max = resolveCount(elt.max, attrs)
      if (maxPos && pos.index == end - 1) max -= maxPos.count

      while (pos.count < max) {
        if (elt.matches(fragment.child(fragPos))) {
          pos.count++
          if (++fragPos == fragment.childCount) return pos
        } else {
          break
        }
      }
      if (!elt.validCount(attrs, pos.count)) return null
      pos.index++
      pos.count = 0
    }
  }

  matchBackward(attrs, fragment, pos) {
    let fragPos = fragment.childCount
    if (fragPos == 0) return pos
    for (;;) {
      if (pos.index == 0) return null
      let elt = this.elements[pos.index - 1], max = resolveCount(elt.max, attrs)
      while (pos.count < max) {
        if (elt.matches(fragment.child(fragPos - 1))) {
          pos.count++
          if (--fragPos == 0) return pos
        } else {
          break
        }
      }
      if (!elt.validCount(attrs, pos.count)) return null
      pos.index--
      pos.count = 0
    }
  }

  matches(attrs, fragment) {
    let pos = this.matchForward(attrs, fragment, new MatchPos(0, 0))
    if (!pos) return false
    for (let i = pos.index; i < this.elements.length; i++)
      if (!this.elements[i].validCount(attrs, i == pos.index ? pos.count : 0)) return false
    return true
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
      let fits = this.matchForward(attrs, mid, new MatchPos(front.index, front.count), back)
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

  fillTo(attrs, pos, end) {
    let found = []
    while (pos.index < end.index)
      if (!this.fillOne(attrs, pos, found, pos.index == end.index - 1 ? end.count : 0)) return null
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
      }
      let newElt = new ContentElement(nodeTypes, markSet, min, max, mod)
      if (elements.length && elements[elements.length - 1].overlaps(newElt))
        throw new SyntaxError("Overlapping adjacent content expressions in '" + expr + "'")
      elements.push(newElt)
    }
    return new ContentExpr(elements)
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

  validCount(attrs, count) {
    let min = resolveCount(this.min, attrs), mod = resolveCount(this.mod, attrs)
    return count >= min && (mod == -1 || count % mod == 0)
  }

  createFiller() {
    // FIXME verify that default content can be created
    for (let i = 0; i < this.nodeTypes.length; i++) {
      let type = this.nodeTypes[i]
      if (type.defaultAttrs)
        return type.create(null, type.fixContent(null, type.defaultAttrs))
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

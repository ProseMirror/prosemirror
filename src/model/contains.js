// Allowed:
//   foo
//   foo[_]
//   foo[strong em]
//   (foo | bar)
//   foo+ => 1,...
//   foo* => 0,...
//   foo? => 0,1
//   foo{n} => n,n
//   foo%n => n,... %n
//   foo{n,m} => n,m
//   foo{n,} => n,...
//   foo bar
// Where N can be:
//   12
//   @attr
//
// So you get a sequence of sets of node types, with sets of marks, repeated X times

export class ContainsExpr {
  constructor(elements) {
    this.elements = elements
  }

  matchForward(attrs, fragment, pos) {
    let fragPos = 0
    for (; pos.index < this.elements.length; pos.index++) {
      let elt = this.elements[pos.index], max = resolveCount(elt.max, attrs)
      for (; pos.count < max; pos.count++) {
        if (fragPos == fragment.childCount) return pos
        if (elt.matches(fragment.child(fragPos))) fragPos++
        else break
      }
      let min = resolveCount(elt.min, attrs), mod = resolveCount(elt.mod, attrs)
      if (pos.count < min || (mod > -1 && pos.count % elt.mod != 0)) return null
      pos.count = 0
    }
    return pos
  }

  matchBackward(attrs, fragment, pos) {
    let fragPos = fragment.childCount
    for (; pos.index >= 0; pos.index--) {
      let elt = this.elements[pos.index], max = resolveCount(elt.max, attrs)
      for (; pos.count < max; pos.count++) {
        if (fragPos == 0) return pos
        if (elt.matches(fragment.child(fragPos - 1))) fragPos--
        else break
      }
      let min = resolveCount(elt.min, attrs), mod = resolveCount(elt.mod, attrs)
      if (pos.count < min || (mod > -1 && pos.count % elt.mod != 0)) return null
      pos.count = 0
    }
    return pos
  }

  matches(attrs, fragment) {
    let pos = matchForward(attrs, fragment, new MatchPos(0, 0))
    return pos && pos.index == this.elements.length
  }

  fill(attrs, before, mid, after) {
    let front = this.matchForward(attrs, before, new MatchPos(0, 0))
    let back = this.matchBackward(attrs, after, new MatchPos(this.elements.length, 0))
    // ...
  }

  static parse(nodeType, expr) {
    let elements = [], pos = 0
    for (;;) {
      pos += /^\s*/.exec(expr.slice(pos))[0].length
      if (pos == expr.length) break

      let types = /^(?:(\w+)|\(\s*(\w+(?:\s*|\s*\w+)*)\s*\))/.exec(expr.slice(pos))
      if (!types) throw new SyntaxError("Invalid contains expression '" + expr + "' at " + pos)
      pos += types[0].length
      let marks = /^\[(?:(_)|\s*(\w+(?:\s+\w+)*)\s*)\]/.exec(expr.slice(pos))
      if (marks) pos += marks[0].length
      let count = /^(?:([+*?])|%(\d+|@\w+)|\{\s*(\d+|@\w+)\s*(,\s*(\d+|@\w+)?)?\s*\})/.exec(expr.slice(pos))
      if (count) pos += count[0].length

      let nodeTypes = expandTypes(nodeType.schema, types[1] ? [types[1]] : types[2].split(/\s*|\s*/))
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
        }
      }
      elements.push(new ContainsElement(nodeTypes, markSet, min, max, mod))
    }
    return new ContainsExpr(elements)
  }
}

class ContainsElement {
  constructor(nodeTypes, marks, min, max, mod) {
    this.nodeTypes = nodeTypes
    this.marks = marks
    this.min = min
    this.max = max
    this.mod = mod
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
  return attrs[count]
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
      let startLen = found.length
      for (let name in schema.nodes)
        if (schema.nodes[name].group == type) group.push(schema.nodes[name])
      if (found.length == startLen)
        throw new SyntaxError("Node type or group '" + type + "' does not exist")
    }
  }
  return found
}

export class StyleMarker {
  constructor(type, attrs) {
    this.type = type
    this.attrs = attrs
  }

  toJSON() {
    if (this.type.instance) return this.type.name
    let obj = {_: this.type.name}
    for (let attr in this.attrs) obj[attr] = this.attrs[attr]
    return obj
  }

  addToSet(set) {
    for (var i = 0; i < set.length; i++) {
      var other = set[i]
      if (other.type == this.type) {
        if (this.eq(other)) return set
        else return [...set.slice(0, i), this, ...set.slice(i + 1)]
      }
      if (other.type.rank > this.type.rank)
        return [...set.slice(0, i), this, ...set.slice(i)]
    }
    return set.concat(this)
  }

  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return [...set.slice(0, i), ...set.slice(i + 1)]
    return set
  }

  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i])) return true
    return false
  }

  eq(other) {
    if (this.type != other.type) return false
    for (let attr in this.attrs)
      if (other.attrs[attr] != this.attrs[attr]) return false
    return true
  }
}

export function removeStyle(set, type) {
  for (var i = 0; i < set.length; i++)
    if (set[i].type == type)
      return [...set.slice(0, i), ...set.slice(i + 1)]
  return set
}

export function sameStyles(a, b) {
  if (a.length != b.length) return false
  for (let i = 0; i < a.length; i++)
    if (!a[i].eq(b[i])) return false
  return true
}

export function containsStyle(set, type) {
  for (let i = 0; i < set.length; i++)
    if (set[i].type == type) return set[i]
  return false
}

const empty = []

export function spanStylesAt(doc, pos) {
  let parent = doc.path(pos.path)
  if (!parent.isTextblock) return empty
  let node = parent.childBefore(pos.offset).node || parent.firstChild
  return node ? node.styles : empty
}

export function rangeHasStyle(doc, from, to, type) {
  let found = false
  doc.inlineNodesBetween(from, to, node => {
    if (containsStyle(node.styles, type)) found = true
  })
  return found
}

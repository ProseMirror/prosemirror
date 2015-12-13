// ;; A mark is a piece of information that can be attached to a node,
// such as it being emphasized, in code font, or a link. It has a type
// and optionally a set of attributes that provide further information
// (such as the target of the link). Marks are created through a
// [schema](#Schema), which controls which types exist and which
// attributes they have.
export class Mark {
  constructor(type, attrs) {
    // :: MarkType
    // The type of this mark.
    this.type = type
    // :: Object
    // The attributes associated with this mark.
    this.attrs = attrs
  }

  // :: () → Object
  // Convert this mark to a JSON-serializeable representation.
  toJSON() {
    if (this.type.instance) return this.type.name
    let obj = {_: this.type.name}
    for (let attr in this.attrs) obj[attr] = this.attrs[attr]
    return obj
  }

  // :: ([Mark]) → [Mark]
  // Given a set of marks, create a new set which contains this one as
  // well, in the right position. If this mark or another of its type
  // is already in the set, the set itself is returned.
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

  // :: ([Mark]) → [Mark]
  // Remove this mark from the given set, returning a new set. If this
  // mark is not in the set, the set itself is returned.
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return [...set.slice(0, i), ...set.slice(i + 1)]
    return set
  }

  // :: ([Mark]) → bool
  // Test whether this mark is in the given set of marks.
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i])) return true
    return false
  }

  // :: (Mark) → bool
  // Test whether this mark has the same type and attributes as
  // another mark.
  eq(other) {
    if (this == other) return true
    if (this.type != other.type) return false
    for (let attr in this.attrs)
      if (other.attrs[attr] != this.attrs[attr]) return false
    return true
  }

  // :: ([Mark], [Mark]) → bool
  // Test whether two sets of marks are identical.
  static sameSet(a, b) {
    if (a == b) return true
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++)
      if (!a[i].eq(b[i])) return false
    return true
  }
}

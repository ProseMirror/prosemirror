const {Fragment, Slice} = require("../model")
const {Step, StepResult} = require("./step")

function mapFragment(fragment, f, parent) {
  let mapped = []
  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i)
    if (child.content.size) child = child.copy(mapFragment(child.content, f, child))
    if (child.isInline) child = f(child, parent, i)
    mapped.push(child)
  }
  return Fragment.fromArray(mapped)
}

// ;; Add a mark to all inline content between two positions.
class AddMarkStep extends Step {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super()
    this.from = from
    this.to = to
    this.mark = mark
  }

  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to)
    let slice = new Slice(mapFragment(oldSlice.content, (node, parent, index) => {
      if (!parent.contentMatchAt(index + 1).allowsMark(this.mark.type)) return node
      return node.mark(this.mark.addToSet(node.marks))
    }, oldSlice.possibleParent), oldSlice.openLeft, oldSlice.openRight)
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert() {
    return new RemoveMarkStep(this.from, this.to, this.mark)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1)
    if (from.deleted && to.deleted || from.pos >= to.pos) return null
    return new AddMarkStep(from.pos, to.pos, this.mark)
  }

  static fromJSON(schema, json) {
    return new AddMarkStep(json.from, json.to, schema.markFromJSON(json.mark))
  }
}
exports.AddMarkStep = AddMarkStep

Step.jsonID("addMark", AddMarkStep)

// ;; Remove a mark from all inline content between two positions.
class RemoveMarkStep extends Step {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super()
    this.from = from
    this.to = to
    this.mark = mark
  }

  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to)
    let slice = new Slice(mapFragment(oldSlice.content, node => {
      return node.mark(this.mark.removeFromSet(node.marks))
    }), oldSlice.openLeft, oldSlice.openRight)
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert() {
    return new AddMarkStep(this.from, this.to, this.mark)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1)
    if (from.deleted && to.deleted || from.pos >= to.pos) return null
    return new RemoveMarkStep(from.pos, to.pos, this.mark)
  }

  static fromJSON(schema, json) {
    return new RemoveMarkStep(json.from, json.to, schema.markFromJSON(json.mark))
  }
}
exports.RemoveMarkStep = RemoveMarkStep

Step.jsonID("removeMark", RemoveMarkStep)

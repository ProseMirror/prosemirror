import {Step, StepResult} from "./step"
import {MapResult} from "./map"

// ;; A change to a document often consists of a series of
// [steps](#Step). This class provides a convenience abstraction to
// build up and track such an array of steps. A `Transform` object
// implements `Mappable`.
//
// The high-level transforming methods return the `Transform` object
// itself, so that they can be chained.
export class Transform {
  // :: (Node)
  // Create a transformation that starts with the given document.
  constructor(doc) {
    this.result = new StepResult(doc)
    this.docs = []
    this.steps = []
    this.maps = []
  }

  get doc() { return this.result.doc }

  get failed() { return this.result.failed }

  get before() { return this.docs.length ? this.docs[0] : this.result.doc }

  static define(name, impl) {
    this.prototype[name] = function() {
      if (!this.failed) impl.apply(this, arguments)
      return this
    }
  }

  // :: (Step) → Transform
  step(step, from, to, param) {
    if (this.failed) return this.result
    return this.result = this.maybeStep(typeof step == "string" ? new Step(step, from, to, param) : step)
  }

  maybeStep(step) {
    let result = step.apply(this.doc)
    if (result.doc) {
      this.docs.push(this.result.doc)
      this.steps.push(step)
      this.maps.push(step.posMap())
      this.result = result
    }
    return result
  }

  // :: (?(Transform) → Transform) → Transform
  try(action) {
    if (this.failed) return this
    let oldLen = this.steps.length, oldResult = this.result
    action(this)
    if (this.failed) {
      this.steps.length = this.maps.length = this.docs.length = oldLen
      this.result = oldResult
    }
    return this
  }

  fail(value) {
    this.result = new StepResult(null, value)
    return this
  }

  // :: (number, ?number) → MapResult
  // Map a position through the whole transformation (all the position
  // maps in [`maps`](#Transform.maps)), and return the result.
  map(pos, bias) {
    let deleted = false
    for (let i = 0; i < this.maps.length; i++) {
      let result = this.maps[i].map(pos, bias)
      pos = result.pos
      if (result.deleted) deleted = true
    }
    return new MapResult(pos, deleted)
  }
}

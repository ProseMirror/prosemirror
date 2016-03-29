import {ProseMirrorError} from "../util/error"

import {Step} from "./step"
import {MapResult} from "./map"

export class TransformError extends ProseMirrorError {}

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
    this.doc = doc
    this.docs = []
    this.steps = []
    this.maps = []
  }

  get before() { return this.docs.length ? this.docs[0] : this.doc }

  // :: (Step) → Transform
  step(step, from, to, param) {
    if (typeof step == "string") step = new Step(step, from, to, param)
    let result = this.maybeStep(step)
    if (result.failed) throw new TransformError(result.failed)
    return this
  }

  maybeStep(step) {
    let result = step.apply(this.doc)
    if (!result.failed) {
      this.docs.push(this.doc)
      this.steps.push(step)
      this.maps.push(step.posMap())
      this.doc = result.doc
    }
    return result
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

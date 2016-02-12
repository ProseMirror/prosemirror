import {Step} from "./step"
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
    // :: [Step]
    // The accumulated steps.
    this.steps = []
    // :: [Node]
    // The individual document versions. Always has a length one more
    // than `steps`, since it also includes the original starting
    // document.
    this.docs = [doc]
    // :: [PosMap]
    // The position maps produced by the steps. Has the same length as
    // `steps`.
    this.maps = []
  }

  // :: Node
  // The current version of the transformed document.
  get doc() {
    return this.docs[this.docs.length - 1]
  }

  // :: Node
  // The original input document.
  get before() {
    return this.docs[0]
  }

  // :: (Step) → ?StepResult
  // Add a step to this transformation. If the step can be
  // [applied](#Step.apply) to the current document, the result of
  // applying it is returned, and an element is added to the
  // [`steps`](#Transform.steps), [`docs`](#Transform.docs), and
  // [`maps`](#Transform.maps) arrays.
  step(step, from, to, pos, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, pos, param)
    let result = step.apply(this.doc)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      this.docs.push(result.doc)
    }
    return result
  }

  // :: (Pos, ?number) → MapResult
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

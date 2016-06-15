const {ProseMirrorError} = require("../util/error")

const {mapThrough, mapThroughResult} = require("./map")

class TransformError extends ProseMirrorError {}
exports.TransformError = TransformError

// ;; A change to a document often consists of a series of
// [steps](#Step). This class provides a convenience abstraction to
// build up and track such an array of steps. A `Transform` object
// implements `Mappable`.
//
// The high-level transforming methods return the `Transform` object
// itself, so that they can be chained.
class Transform {
  // :: (Node)
  // Create a transformation that starts with the given document.
  constructor(doc) {
    // :: Node
    // The current document (the result of applying the steps in the
    // transform).
    this.doc = doc
    // :: [Step]
    // The steps in this transform.
    this.steps = []
    // :: [Node]
    // The documents before each of the steps.
    this.docs = []
    // :: [PosMap]
    // The position maps for each of the steps in this transform.
    this.maps = []
  }

  // :: Node The document at the start of the transformation.
  get before() { return this.docs.length ? this.docs[0] : this.doc }

  // :: (Step) → Transform
  // Apply a new step in this transformation, saving the result.
  // Throws an error when the step fails.
  step(step) {
    let result = this.maybeStep(step)
    if (result.failed) throw new TransformError(result.failed)
    return this
  }

  // :: (Step) → StepResult
  // Try to apply a step in this transformation, ignoring it if it
  // fails. Returns the step result.
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
  mapResult(pos, bias, start) { return mapThroughResult(this.maps, pos, bias, start) }

  // :: (number, ?number) → number
  // Map a position through the whole transformation, and return the
  // mapped position.
  map(pos, bias, start) { return mapThrough(this.maps, pos, bias, start) }
}
exports.Transform = Transform

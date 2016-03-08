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
  constructor(doc, failed, history) {
    this.doc = doc
    this.failed = failed
    this.history = history || []
  }

  static define(name, impl) {
    this.prototype[name] = function() {
      return this.failed ? this : impl.apply(this, arguments)
    }
  }

  // :: (Step) → Transform
  step(step, from, to, param) {
    if (this.failed) return this
    if (typeof step == "string") step = new Step(step, from, to, param)
    let result = step.apply(this.doc)
    if (result.doc)
      return new Transform(result.doc, null,
                           this.history.concat({doc: this.doc, map: step.getMap(this.doc), step}))
    else
      return new Transform(null, result.failed, this.history)
  }

  // :: (?(Transform) → Transform) → Transform
  try(action) {
    if (this.failed) return this
    let ran = action(this)
    return ran.failed ? this : ran
  }

  // :: (number, ?number) → MapResult
  // Map a position through the whole transformation (all the position
  // maps in [`maps`](#Transform.maps)), and return the result.
  map(pos, bias) {
    let deleted = false
    for (let i = 0; i < this.history.length; i++) {
      let result = this.history[i].map.map(pos, bias)
      pos = result.pos
      if (result.deleted) deleted = true
    }
    return new MapResult(pos, deleted)
  }

  get maps() { return this.history.map(h => h.map) }

  get before() { return this.history.length ? this.history[0].doc : this.doc }
}

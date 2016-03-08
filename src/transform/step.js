import {NamespaceError} from "../util/error"

import {PosMap} from "./map"

// ;; A step object wraps an atomic operation. It generally applies
// only to the document it was created for, since the positions
// associated with it will only make sense for that document.
export class Step {
  // :: (string, number, number, ?any)
  // Build a step. The type should name a [defined](Step.define) step
  // type, and the shape of the positions and parameter should be
  // appropriate for that type.
  constructor(type, from, to, param = null) {
    if (!(type in steps)) throw new NamespaceError("Unknown step type: " + type)
    // :: string
    // The type of the step.
    this.type = type
    // :: ?number
    // The start of the step's range, if any. Which of the three
    // optional positions associated with a step a given step type
    // uses differs. The way each of these positions is mapped when
    // the step is mapped over a [position mapping](#PosMap) depends
    // on its role.
    this.from = from
    // :: ?number
    // The end of the step's range.
    this.to = to
    // :: ?any
    // Extra step-type-specific information associated with the step.
    this.param = param
  }

  // :: (Node) → ?StepResult
  // Applies this step to the given document, returning a result
  // containing the transformed document (the input document is not
  // changed) and a `PosMap`. If the step could not meaningfully be
  // applied to the given document, this returns `null`.
  apply(doc) {
    return steps[this.type].apply(doc, this)
  }

  getMap() {
    let type = steps[this.type]
    return type.getMap ? type.getMap(this) : PosMap.empty
  }

  // :: (Node, PosMap) → Step
  // Create an inverted version of this step. Needs the document as it
  // was before the step, as well as `PosMap` created by applying the
  // step to that document, as input.
  invert(oldDoc, map) {
    return steps[this.type].invert(this, oldDoc, map)
  }

  // :: (Mappable) → ?Step
  // Map this step through a mappable thing, returning either a
  // version of that step with its positions adjusted, or `null` if
  // the step was entirely deleted by the mapping.
  map(remapping) {
    let allDeleted = true
    let from = null, to = null

    if (this.from) {
      let result = remapping.map(this.from, 1)
      from = result.pos
      if (!result.deleted) allDeleted = false
    }
    if (this.to) {
      if (this.to == this.from) {
        to = from
      } else {
        let result = remapping.map(this.to, -1)
        to = Math.max(result.pos, from)
        if (!result.deleted) allDeleted = false
      }
    }
    return allDeleted ? null : new Step(this.type, from, to, this.param)
  }

  // :: () → Object
  // Create a JSON-serializeable representation of this step.
  toJSON() {
    let impl = steps[this.type]
    return {
      type: this.type,
      from: this.from,
      to: this.to,
      param: impl.paramToJSON ? impl.paramToJSON(this.param) : this.param
    }
  }

  // :: (Schema, Object) → Step
  // Deserialize a step from its JSON representation.
  static fromJSON(schema, json) {
    let impl = steps[json.type]
    return new Step(
      json.type,
      json.from,
      json.to,
      impl.paramFromJSON ? impl.paramFromJSON(schema, json.param) : json.param)
  }

  // :: (string, Object)
  // Define a new type of step. Implementation should have the
  // following properties:
  //
  // **`apply`**`(doc: Node, step: Step) → ?StepResult
  //   : Applies the step to a document.
  // **`invert`**`(step: Step, oldDoc: Node, map: PosMap) → Step
  //   : Create an inverted version of the step.
  // **`paramToJSON`**`(param: ?any) → ?Object
  //   : Serialize this step type's parameter to JSON.
  // **`paramFromJSON`**`(schema: Schema, json: ?Object) → ?any
  //   : Deserialize this step type's parameter from JSON.
  static define(type, implementation) {
    steps[type] = implementation
  }
}

const steps = Object.create(null)

export class StepResult {
  constructor(doc, failed) {
    this.doc = doc
    this.failed = failed
  }

  static ok(doc) { return new StepResult(doc, null) }
  static fail(val) { return new StepResult(null, val) }
}

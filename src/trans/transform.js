import {MapResult, nullMap} from "./map"

export class Step {
  constructor(name, from, to, param = null) {
    this.name = name
    this.from = from
    this.to = to
    this.param = param
  }
}

const steps = Object.create(null)

export function defineStep(name, impl) { steps[name] = impl }

export function applyStep(doc, step) {
  if (!(step.name in steps))
    throw new Error("Undefined transform " + transform.name)
  return steps[step.name].apply(doc, step)
}

export function invertStep(result, step) {
  return steps[step.name].invert(result, step)
}

export class Result {
  constructor(before, after = before, map = nullMap) {
    this.before = before
    this.doc = after
    this.map = map
  }
}

export class Transform {
  constructor(doc) {
    this.before = this.doc = doc
    this.steps = []
    this.results = []
  }

  step(step, from, to, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, param)
    let result = applyStep(this.doc, step)
    if (result) {
      this.steps.push(step)
      this.results.push(result)
      this.doc = result.doc
    }
  }

  invert() {
    let inverted = new Transform(this.doc)
    for (let i = this.steps.length - 1; i >= 0; i--)
      inverted.step(invertStep(this.results[i], this.steps[i]))
    return inverted
  }

  map(pos, bias = 0, back = false, offsets = null) {
    let storeOffsets = offsets === true && []
    let hasOffsets = !storeOffsets && offsets
    let deleted = false
    for (let i = back ? this.steps.length - 1 : 0;
         back ? i >= 0 : i < this.steps.length;
         back ? i-- : i++) {
      let mapped = this.results[i].map.map(pos, bias, back, hasOffsets && hasOffsets[i])
      if (mapped.deleted) deleted = true
      if (storeOffsets) storeOffsets.push(mapped.offset)
      pos = mapped.pos
    }
    return new MapResult(pos, storeOffsets, deleted)
  }

  mapSimple(pos, bias = 0, back = false) {
    return this.map(pos, bias, back).pos
  }
}

export function T(doc) { return new Transform(doc) }

import {mapThrough, nullMap} from "./map"

export class Step {
  constructor(name, from, to, pos, param = null) {
    this.name = name
    this.from = from
    this.to = to
    this.pos = pos
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

export function invertStep(step, oldDoc, map) {
  return steps[step.name].invert(step, oldDoc, map)
}

export class TransformResult {
  constructor(doc, map = nullMap) {
    this.doc = doc
    this.map = map
  }
}

export class Transform {
  constructor(doc) {
    this.doc = doc
    this.docs = []
    this.steps = []
    this.maps = []
  }

  step(step, from, to, pos, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, pos, param)
    let result = applyStep(this.doc, step)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      this.docs.push(this.doc)
      this.doc = result.doc
    }
    return result
  }
}

export function Tr(doc) { return new Transform(doc) }

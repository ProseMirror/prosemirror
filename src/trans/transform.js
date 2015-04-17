import {nullMap} from "./map"

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
    this.doc = doc
    this.steps = []
  }

  addStep(name, from, to, param) {
    this.steps.push(new Step(name, from, to, param))
  }
}

export function T(doc) { return new Transform(doc) }

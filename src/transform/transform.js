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
    this.maps = []
  }

  step(step, from, to, pos, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, pos, param)
    let result = applyStep(this.doc, step)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      this.doc = result.doc
    }
    return result
  }

  invert() {
    let doc = this.before, inverted = []
    for (let i = 0; i < this.steps.length; i++) {
      let result = applyStep(doc, this.steps[i])
      inverted.push(invertStep(result, this.steps[i]))
      doc = result.doc
    }
    let out = Tr(this.doc)
    for (let i = inverted.length - 1; i >= 0; i--)
      out.step(inverted[i])
    return out
  }

  map(pos, bias = 0, back = false, offsets = null, from = null) {
    let maps = this.maps
    if (from != null) maps = back ? maps.slice(0, from) : maps.slice(from)
    return mapThrough(maps, pos, bias, back, offsets)
  }

  mapSimple(pos, bias = 0, back = false) {
    return this.map(pos, bias, back).pos
  }
}

export function Tr(doc) { return new Transform(doc) }

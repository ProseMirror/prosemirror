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
  constructor(doc, storeInverses) {
    this.before = this.doc = doc
    this.steps = []
    this.maps = []
    this.inverted = storeInverses && []
  }

  step(step, from, to, pos, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, pos, param)
    let result = applyStep(this.doc, step)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      if (this.inverted) this.inverted.unshift(invertStep(result, step))
      this.doc = result.doc
    }
    return result
  }

  invert() {
    let inverted = Tr(this.doc)
    this.inverted.forEach(s => inverted.step(s))
    return inverted
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

export function Tr(doc, storeInverses) { return new Transform(doc, storeInverses) }

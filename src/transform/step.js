import {Pos, Node} from "../model"

export class Step {
  constructor(name, from, to, pos, param = null) {
    if (!(name in steps)) throw new Error("Unknown step type: " + name)
    this.name = name
    this.from = from
    this.to = to
    this.pos = pos
    this.param = param
  }

  toJSON() {
    let impl = steps[this.name]
    return {
      name: this.name,
      from: this.from,
      to: this.to,
      pos: this.pos,
      param: impl.paramToJSON ? impl.paramToJSON(this.param) : this.param
    }
  }

  static fromJSON(json) {
    let impl = steps[json.name]
    return new Step(
      json.name,
      json.from && Pos.fromJSON(json.from),
      json.to && Pos.fromJSON(json.to),
      json.pos && Pos.fromJSON(json.pos),
      impl.paramFromJSON ? impl.paramFromJSON(json.param) : json.param)
  }
}

const steps = Object.create(null)

export function defineStep(name, impl) { steps[name] = impl }

export function applyStep(doc, step) {
  if (!(step.name in steps))
    throw new Error("Undefined transform " + step.name)

  return steps[step.name].apply(doc, step)
}

export function invertStep(step, oldDoc, map) {
  return steps[step.name].invert(step, oldDoc, map)
}


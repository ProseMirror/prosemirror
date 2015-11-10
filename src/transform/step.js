import {Pos} from "../model"

export class Step {
  constructor(name, from, to, pos, param = null) {
    if (!(name in steps)) throw new Error("Unknown step type: " + name)
    this.name = name
    this.from = from
    this.to = to
    this.pos = pos
    this.param = param
  }

  apply(doc) {
    return steps[this.name].apply(doc, this)
  }

  invert(oldDoc, map) {
    return steps[this.name].invert(this, oldDoc, map)
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

  static fromJSON(schema, json) {
    let impl = steps[json.name]
    return new Step(
      json.name,
      json.from && Pos.fromJSON(json.from),
      json.to && Pos.fromJSON(json.to),
      json.pos && Pos.fromJSON(json.pos),
      impl.paramFromJSON ? impl.paramFromJSON(schema, json.param) : json.param)
  }
}

const steps = Object.create(null)

export function defineStep(name, impl) { steps[name] = impl }

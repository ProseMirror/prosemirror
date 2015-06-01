import {Pos, Node} from "../model"

export class Step {
  constructor(name, from, to, pos, param = null) {
    this.name = name
    this.from = from
    this.to = to
    this.pos = pos
    this.param = param
  }

  toJSON() {
    return {
      name: this.name,
      from: this.from,
      to: this.to,
      pos: this.pos,
      param: objectToJSON(this.param)
    }
  }

  static fromJSON(json) {
    return new Step(
      json.name,
      json.from && Pos.fromJSON(json.from),
      json.to && Pos.fromJSON(json.to),
      json.pos && Pos.fromJSON(json.pos),
      objectFromJSON(json.param))
  }
}

function objectToJSON(obj) {
  if (!obj || typeof obj != "object") return obj
  if (Array.isArray(obj)) return obj.map(objectToJSON)
  if (obj.toJSON) return obj.toJSON()
  let result = {}
  for (let prop in obj) result[prop] = objectToJSON(obj[prop])
  return result
}

function objectFromJSON(json) {
  if (!json || typeof json != "object") return json
  if (Array.isArray(json)) return json.map(objectFromJSON)
  if (json.attrs && json.content) return Node.fromJSON(json)
  let result = {}
  for (let prop in json) result[prop] = objectFromJSON(json[prop])
  return result
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


import {Pos, Node} from "../model"
import {Step} from "../transform"

export function stepToJSON(step) {
  return {
    name: step.name,
    from: step.from,
    to: step.to,
    pos: step.pos,
    param: objectToJSON(step.param)
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

export function stepFromJSON(step) {
  return new Step(
    step.name,
    step.from && Pos.fromJSON(step.from),
    step.to && Pos.fromJSON(step.to),
    step.pos && Pos.fromJSON(step.pos),
    objectFromJSON(step.param))
}

function objectFromJSON(json) {
  if (!json || typeof json != "object") return json
  if (Array.isArray(json)) return json.map(objectFromJSON)
  if (json.attrs && json.content) return Node.fromJSON(json)
  let result = {}
  for (let prop in json) result[prop] = objectFromJSON(json[prop])
  return result
}

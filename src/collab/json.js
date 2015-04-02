import {Pos, Node} from "../model"

// FIXME minimize (slice) source documents in "replace" queries

export function transitionToJSON(transition) {
  let result = {}
  for (let prop in transition) {
    let value = transition[prop]
    if (value == null) continue
    if (value.toJSON) value = value.toJSON()
    result[prop] = value
  }
  return result
}

export function transitionFromJSON(json) {
  let result = {}
  for (let prop in json) {
    let value = json[prop]
    if (value.attrs && value.content)
      value = Node.fromJSON(value)
    else if (value.path && value.offset != null)
      value = Pos.fromJSON(value)
    result[prop] = value
  }
  return result
}

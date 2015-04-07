import {Pos, Node} from "../model"

// FIXME minimize (slice) source documents in "replace" queries

export function paramsToJSON(params) {
  let result = {}
  for (let prop in params) {
    let value = params[prop]
    if (value == null) continue
    if (value.toJSON) value = value.toJSON()
    result[prop] = value
  }
  return result
}

export function paramsFromJSON(json) {
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

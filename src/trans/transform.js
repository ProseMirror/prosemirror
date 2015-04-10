import {nullMap} from "./map"

export class Step {
  constructor(name, from, to, param) {
    this.name = name
    this.from = from
    this.to = to
    this.param = param
  }
}

const transforms = Object.create(null)

export function defineTransform(name, impl) { transforms[name] = impl }

export function applyTransform(doc, transform) {
  if (!(transform.name in transforms))
    throw new Error("Undefined transform " + transform.name)
  return transforms[transform.name].apply(doc, transform)
}

export class Result {
  constructor(before, after = before, map = nullMap) {
    this.before = before
    this.doc = after
    this.map = map
  }
}

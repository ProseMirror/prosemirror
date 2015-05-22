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
    throw new Error("Undefined transform " + step.name)

  return steps[step.name].apply(doc, step)
}

export function invertStep(step, oldDoc, map) {
  return steps[step.name].invert(step, oldDoc, map)
}


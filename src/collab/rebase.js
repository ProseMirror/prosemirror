import {Step, MapResult, applyStep} from "../transform"

export function rebaseChanges(doc, forward, changes) {
  let remap = new Remapping([], forward.slice())
  let rebased = []
  for (let i = 0; i < changes.length; i++) {
    let change = changes[i]
    let step = mapStep(change.step, remap)
    let result = step && applyStep(doc, step)
    if (result) {
      rebased.push({step: step, map: result.map, doc})
      doc = result.doc

      remap.corresponds[remap.back.length] = remap.forward.length
      remap.forward.push(result.map)
    }
    remap.back.push(change.map)
  }
  return {doc, changes: rebased, mapping: remap}
}

export class Remapping {
  constructor(back, forward, corresponds, mapBack = true) {
    this.back = back
    this.forward = forward
    this.corresponds = corresponds || Object.create(null)
    this.mapBack = mapBack
  }

  map(pos, bias) {
    let deleted = false, start = 0

    for (let i = this.back.length - 1; i >= 0; i--) {
      let result = this.back[i].map(pos, bias * (this.mapBack ? -1 : 1), this.mapBack)
      if (result.recover) {
        let corr = this.corresponds[i]
        if (corr != null) {
          start = corr + 1
          pos = this.forward[corr].recover(result.recover)
          break
        }
      }
      if (result.deleted) deleted = true
      pos = result.pos
    }

    for (let i = start; i < this.forward.length; i++) {
      let result = this.forward[i].map(pos, bias)
      if (result.deleted) deleted = true
      pos = result.pos
    }

    return new MapResult(pos, deleted)
  }
}

function maxPos(a, b) {
  return a.cmp(b) > 0 ? a : b
}

export function mapStep(step, remapping) {
  let allDeleted = true
  let from = null, to = null, pos = null
  if (step.from) {
    let result = remapping.map(step.from, 1)
    from = result.pos
    if (!result.deleted) allDeleted = false
  }
  if (step.to) {
    if (step.to.cmp(step.from) == 0) {
      to = from
    } else {
      let result = remapping.map(step.to, -1)
      to = maxPos(result.pos, from)
      if (!result.deleted) allDeleted = false
    }
  }
  if (step.pos) {
    if (from && step.pos.cmp(step.from) == 0) {
      pos = from
    } else if (to && step.pos.cmp(step.to) == 0) {
      pos = to
    } else {
      let result = remapping.map(step.pos, 1)
      pos = result.pos
      if (!result.deleted) allDeleted = false
    }
  }
  if (!allDeleted) return new Step(step.name, from, to, pos, step.param)
}

import {childID} from "./id"
import {Transition} from "./versions"
import {Tr, Step, MapResult, applyStep} from "../transform"

export function mergeTransitionSets(old, nw) {
  let result = []
  let iOld = 0, iNew = 0
  for (;;) {
    if (iOld == old.length) return result.concat(nw.slice(iNew))
    if (iNew == nw.length) return result.concat(old.slice(iOld))
    let eOld = old[iOld], eNew = nw[iNew]
    if (eOld.clientID > eNew.clientID) {
      result.push(eNew)
      ++iNew
    } else {
      result.push(eOld)
      ++iOld
    }
  }
}

export class Remapping {
  constructor(back, forward, corresponds) {
    this._back = back
    this._forward = forward
    this.corresponds = corresponds || {}
  }

  map(pos, bias) {
    let deleted = false, start = 0

    for (let i = this._back.length - 1; i >= 0; i--) {
      let result = this._back[i].map(pos, -bias, true)
      if (result.recover) {
        let corr = this.corresponds[i]
        if (corr != null) {
          start = corr + 1
          pos = this._forward[corr].recover(result.recover)
          break
        }
      }
      if (result.deleted) deleted = true
      pos = result.pos
    }

    for (let i = start; i < this._forward.length; i++) {
      let result = this._forward[i].map(pos, bias)
      if (result.deleted) deleted = true
      pos = result.pos
    }

    return new MapResult(pos, deleted)
  }
}

// FIXME this is repeating quite a lot of work. Optimize the case
// where subsequent ops already followed each other (and we can simply
// add a single entry to the previous object)

function remapping(back, forward) {
  let corresponding = Object.create(null)
  for (let i = 0; i < back.length; i++)
    for (let j = 0; j < forward.length; j++)
      if (back[i].id == forward[j].id) corresponding[i] = j
  return new Remapping(back.map(t => t.map), forward.map(t => t.map),
                       corresponding)
}

export function rebaseTransitions(baseID, transitions, store) {
  let id = baseID
  let forward = [], doc = store.getVersion(baseID)

  for (let i = 0; i < transitions.length; i++) {
    let tr = transitions[i]
    let remap = remapping(store.transitionsBetween(baseID, tr.baseID), forward)
    let mapped = mapStep(tr.step, remap)
    if (!mapped) continue
    let result = applyStep(doc, mapped)
    let nextID = childID(id, tr.id)
    store.storeVersion(nextID, id, result.doc)
    let newTr = new Transition(tr.id, id, tr.clientID, mapped, result.map)
    store.storeTransition(newTr)
    forward.push(newTr)
    id = nextID
    doc = result.doc
  }
  return {id, doc, transitions: forward, map: remapping(store.transitionsBetween(baseID, id), forward)}
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

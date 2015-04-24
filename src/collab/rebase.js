import {childID} from "./id"
import {Transition} from "./versions"
import {Tr, Step, MapResult} from "../transform"

export function mergeChangeSets(old, nw) {
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

export function mapPosition(back, forward, pos, bias) {
  let offsets = Object.create(null)
  let deleted = false
  
  for (let i = back.length - 1; i >= 0; i--) {
    let result = back[i].transform.map(pos, -bias, true, true)
    pos = result.pos
    offsets[back[i].id] = result.offset
  }
  for (let i = 0; i < forward.length; i++) {
    let off = offsets[forward[i].id]
    let result = forward[i].transform.map(pos, bias, false, off)
    if (!off && result.deleted) deleted = true
    pos = result.pos
  }

  return new MapResult(pos, null, deleted)
}

function maxPos(a, b) {
  return a.cmp(b) > 0 ? a : b
}

export function mapStep(step, mapper) {
  let allDeleted = true
  let from = null, to = null, pos = null
  if (step.from) {
    let result = mapper(step.from, 1)
    from = result.pos
    if (!result.deleted) allDeleted = false
  }
  if (step.to) {
    if (step.to.cmp(step.from) == 0) {
      to = from
    } else {
      let result = mapper(step.to, -1)
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
      let result = mapper(step.pos, 1)
      pos = result.pos
      if (!result.deleted) allDeleted = false
    }
  }
  if (!allDeleted) return new Step(step.name, from, to, pos, step.param)
}

function mapTransform(back, forward, transform) {
  if (!forward.length && !back.length) return transform
  let result = Tr(forward.length ? forward[forward.length - 1].transform.doc : back[0].transform.before)

  function map(pos, bias) {
    let local = transform.map(pos, -bias, true, true, result.length - 1)
    let other = mapPosition(back, forward, local.pos, bias)
    let end = result.map(other.pos, bias, false, local.offsets)
    return new MapResult(end.pos, null, other.deleted || end.deleted)
  }

  for (let i = 0; i < transform.steps.length; i++) {
    let step = mapStep(transform.steps[i], map)
    if (step) result.step(step)
  }
  return result
}

export function rebaseChanges(baseID, transitions, store) {
  let id = baseID, doc = store.getVersion(baseID)
  let forward = [], backToCurrent
  for (let i = 0; i < transitions.length; i++) {
    let tr = transitions[i]
    let back = store.transitionsBetween(baseID, tr.baseID)
    let mapped = mapTransform(back, forward, tr.transform)
    let nextID = childID(id, tr.id)
    store.storeVersion(nextID, id, mapped.doc)
    let newTr = new Transition(tr.id, id, tr.clientID, mapped)
    store.storeTransition(newTr)
    forward.push(newTr)
    id = nextID
    doc = mapped.doc
  }
  return {id, doc, transitions: forward}
}

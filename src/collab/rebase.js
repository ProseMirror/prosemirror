import {xorIDs} from "./id"
import {Transition} from "./versions"
import {T, Step} from "../trans"

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

  return {pos, deleted}
}

function mapTransform(back, forward, transform) {
  if (!forward.length && !back.length) return transform
  let result = T(forward.length ? forward[forward.length - 1].transform.doc : back[0].transform.before)
  function map(pos, bias) {
    if (pos == null) return {pos: pos, deleted: true}

    let local = transform.map(pos, -bias, true, true, result.length)
    let other = mapPosition(back, forward, local.pos, bias)
    let end = result.map(other.pos, bias, false, local.offsets)
    return {pos: end.pos, deleted: other.deleted || end.deleted}
  }

  for (let i = 0; i < transform.steps.length; i++) {
    let step = transform.steps[i]
    let from = map(step.from, 1)
    let to = map(step.to, -1)
    let pos = map(step.pos, 1)
    if (!from.deleted || !to.deleted || !pos.deleted)
      result.step(step.name, from.pos, to.pos, pos.pos, step.param)
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
    let nextID = xorIDs(id, tr.id)
    store.storeVersion(nextID, id, mapped.doc)
    let newTr = new Transition(tr.id, id, tr.clientID, mapped)
    store.storeTransition(newTr)
    forward.push(newTr)
    id = nextID
    doc = mapped.doc
  }
  return {id: id, doc: doc, forward: forward}
}

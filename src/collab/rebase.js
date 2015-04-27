import {childID} from "./id"
import {Transition} from "./versions"
import {Tr, Step, MapResult, Remapping, applyStep} from "../transform"

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

function findIndex(id, transitions) {
  for (let i = 0; i < transitions.length; i++)
    if (transitions[i].id == id) return i
}

export function rebaseChanges(baseID, transitions, store) {
  let id = baseID
  let forward = [], doc = store.getVersion(baseID)

  for (let i = 0; i < transitions.length; i++) {
    let tr = transitions[i]
    let remap = new Remapping
    let back = store.transitionsBetween(baseID, tr.baseID)
    back.forEach(tr => remap.back(tr.map))
    forward.forEach(tr => remap.forward(tr.map, findIndex(tr.id, back)))
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
  return {id, doc, transitions: forward}
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

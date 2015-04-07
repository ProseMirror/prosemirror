import {xorIDs} from "./id"
import {Transition} from "./versions"
import {applyTransform, flatTransform} from "../transform"

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

export function mapPosition(back, forward, pos) {
  let offsets = Object.create(null)
  let current, deleted = false
  function storeOffset(offset) { offsets[current.id] = offset }
  function setDeleted(offset) { if (offset.inside) deleted = true }

  for (let i = back.length - 1; i >= 0; i--) {
    current = back[i]
    let p1 = pos
    pos = current.result.mapBack(pos, storeOffset)
  }
  for (let i = 0; i < forward.length; i++) {
    let current = forward[i]
    pos = current.result.map(pos, offsets[current.id] || setDeleted)
  }

  return {pos: pos, deleted: deleted}
}

function mapParams(back, forward, params) {
  let result = {}
  let allDeleted = true
  for (var prop in params) {
    let value = params[prop]
    if (prop == "pos" || prop == "end") {
      let result = mapPosition(back, forward, value)
      value = result.pos
      if (!result.deleted) allDeleted = false
    }
    result[prop] = value
  }
  return {params: result, deleted: allDeleted}
}

export function rebaseChanges(baseID, transitions, store) {
  let id = baseID, doc = store.getVersion(baseID)
  let forward = [], backToCurrent
  for (let i = 0; i < transitions.length; i++) {
    let tr = transitions[i]
    let back = store.transitionsBetween(baseID, tr.baseID)
    let {params, deleted} = mapParams(back, forward, tr.params)
    let nextID = xorIDs(id, tr.id)
    let result = deleted ? flatTransform(doc) : applyTransform(doc, params)
    store.storeVersion(nextID, id, result.doc)
    let newTr = new Transition(tr.id, id, tr.clientID, params, result)
    store.storeTransition(newTr)
    forward.push(newTr)
    id = nextID
    doc = result.doc
  }
  return {id: id, doc: doc, forward: forward}
}

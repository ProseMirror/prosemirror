import {Tr, mapThrough} from "../transform"

import {xorIDs} from "./id"
import {mapStep} from "./rebase"

class Change {
  constructor(id, maps) {
    this.id = id
    this.maps = maps
  }
}

export class CollabHistory {
  constructor(pm, collab) {
    this.pm = pm
    this.collab = collab

    this.history = []
    this.done = []
    this.undone = []
    this.lastAddedAt = 0
    this.captureTransitions = null
  }

  mark() {}

  markTransition(tr) {
    if (this.captureTransitions) {
      this.captureTransitions.push(tr)
      return
    }

    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push([tr])
      // FIXME enforce options.historyDepth
    } else {
      this.done[this.done.length - 1].push(tr)
    }
    this.undone.length = 0
    this.lastAddedAt = now
  }

  rebasedTransitions(trs) {
    outer: for (let i = 0; i < trs.length; i++) {
      let tr = trs[i]
      for (let j = 0; j < this.undone.length; j++) {
        let undone = this.undone[j]
        for (let k = 0; k < undone.length; k++)
          if (undone[k].id == tr.id) { undone[k] = tr; continue outer }
      }
      for (let j = this.done.length - 1; j >= 0; j--) {
        let done = this.done[j]
        for (let k = done.length - 1; k >= 0; k--)
          if (done[k].id == tr.id) { done[k] = tr; continue outer }
      }
    }
  }

  confirm(transitions) {
    for (let i = 0; i < transitions.length; i++)
      this.history.push(new Change(transitions[i].baseID, transitions[i].transform.maps))
  }

  fullHistory() {
    let unconfirmed = this.collab.unconfirmedChanges()
    if (unconfirmed.length == 0) return this.history
    let history = this.history.slice()
    for (let i = 0; i < unconfirmed.length; i++)
      history.push(new Change(unconfirmed[i].baseID, unconfirmed[i].transform.maps))
    return history
  }

  mapsBetween(history, fromID, toID) {
    let result = []
    if (fromID == toID) return result
    let i = history.length - 1
    if (toID != this.collab.versionID) for (;; i--) {
      let change = history[i]
      if (change.id == toID) { i--; break }
      if (i == 0) throw new Error("Failed to find end id " + toID + " in history")
    }
    for (;; i--) {
      let change = history[i]
      for (let j = change.maps.length - 1; j >= 0; j--)
        result.push(change.maps[j])
      if (change.id == fromID) break
      if (i == 0) throw new Error("Failed to find start ID " + fromID + " in history")
    }
    result.reverse()
    return result
  }

  unredo(un) {
    let source = un ? this.done : this.undone
    let dest = un ? this.undone : this.done

    if (!source.length) return false
    let transitions = source.pop()
    let history = this.fullHistory()

    let tr = this.pm.tr
    let maps = [], mapsTo = this.collab.versionID

    function mapPos(pos, bias) {
      return mapThrough(maps, pos, bias)
    }

    let contra = []
    this.captureTransitions = contra

    for (let i = transitions.length - 1; i >= 0; i--) {
      let {transform, baseID, id} = transitions[i]
      let endID = xorIDs(baseID, id)
      maps = this.mapsBetween(history, endID, mapsTo).concat(maps)

      let steps = transform.invertedSteps(), result = this.pm.tr
      for (let j = 0; j < steps.length; j++) {
        let mapped = mapStep(steps[j], mapPos), startLen = result.maps.length
        if (mapped) {
          result.step(mapped)
          if (result.maps.length != startLen)
            maps.push(result.maps[startLen])
        }
        maps.unshift(transform.maps[transform.maps.length - 1 - j])
      }
      mapsTo = baseID
      this.pm.apply(result)
    }

    this.captureTransitions = null
    if (contra.length) dest.push(contra)
  }

  undo() { this.unredo(true) }

  redo() { this.unredo(false) }
}

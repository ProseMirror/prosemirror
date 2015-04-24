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
      if (this.done.length > this.pm.options.historyDepth) {
        this.done.splice(0, this.done.length - options.historyDepth)
        this.shortenHistory()
      }
    } else {
      this.done[this.done.length - 1].push(tr)
    }
    this.undone.length = 0

    this.lastAddedAt = now
    this.mustShortenHistory = false
  }

  rebasedTransitions(trs) {
    outer: for (let i = 0; i < trs.length; i++) {
      let tr = trs[i]
      for (let j = this.undone.length - 1; j >= 0; j--) {
        let undone = this.undone[j]
        for (let k = undone.length - 1; k >= 0; k--)
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

    let ported = this.portEvent(transitions)

    let contra = this.captureTransitions = []
    for (let i = 0; i < ported.length; i++)
      this.pm.apply(ported[i])
    this.captureTransitions = null

    if (contra.length) dest.push(contra)
    else this.unredo(un)
  }

  undo() { this.unredo(true) }

  redo() { this.unredo(false) }

  shortenHistory() {
    if (!this.done.length && !this.undone.length) {
      this.history.length = 0
    } else {
      let oldest = this.done.length ? this.done[0][0].baseID : this.undone[0][0].baseID
      if (!this.collab.store.knows(oldest)) for (let i = 0;; i++) {
        if (this.history[i].id == oldest) {
          this.history.splice(0, i)
          break
        }
      }
    }
  }

  portEventFrom(array) {
    for (let i = 0; i < array.length; i++) {
      let event = array[i], last = event[event.length - 1]
      // If this ends before the current confirmed version, it can be ported
      if (!this.collab.store.knows(last.endID)) {
        array[i] = this.portEvent(event, this.history, this.collab.versionID)
        return true
      }
    }
  }

  portEvent(transitions, history, versionID) {
    let maps = [], mapsTo = versionID
    let doc = this.collab.store.getVersion(versionID)
    let result = []

    function mapPos(pos, bias) {
      return mapThrough(maps, pos, bias)
    }

    for (let i = transitions.length - 1; i >= 0; i--) {
      let {transform, baseID, id} = transitions[i]
      let endID = xorIDs(baseID, id)
      maps = this.mapsBetween(history, endID, mapsTo).concat(maps)

      let steps = transform.invertedSteps(), newTransform = Tr(doc)
      for (let j = 0; j < steps.length; j++) {
        let mapped = mapStep(steps[j], mapPos), startLen = newTransform.maps.length
        if (mapped) {
          newTransform.step(mapped)
          if (newTransform.maps.length != startLen)
            maps.push(newTransform.maps[startLen])
        }
        maps.unshift(transform.maps[transform.maps.length - 1 - j])
      }
      mapsTo = baseID
      result.push(new Transition(id, baseID, this.collab.clientID, newTransform))
      doc = newTransform.doc
    }
    return result
  }

  compressData() {
    // FIXME avoid recompressing the same events all the time
    if (this.history.length > 25 &&
        (compressEventFrom(this.done) || compressEventFrom(this.undone))) {
      this.mustShortenHistory = true
      return true
    } else {
      if (this.mustShortenHistory) this.shortenHistory()
      return false
    }
  }
}

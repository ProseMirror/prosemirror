import {Tr, invertStep} from "../transform"

import {mapStep, Remapping} from "./rebase"

class Change {
  constructor(stateID, version, data) {
    this.stateID = stateID
    this.version = version
    this.inverted = null
  }
}

export class CollabHistory {
  constructor(pm, collab) {
    this.pm = pm
    this.collab = collab

    this.maps = []
    this.mapStartVersion = collab.version

    this.done = []
    this.localStepCount = this.foreignStepCount = 0
    this.stateID = this.stateIDCounter = 0
    this.undone = []
    this.lastAddedAt = 0
    this.captureChanges = null
  }

  mark() {}

  markStep(version) {
    let ch = new Change(this.stateID, version)
    if (this.captureChanges) {
      this.captureChanges.push(ch)
      return
    }

    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push([ch])
      if (this.done.length > this.pm.options.historyDepth) {
        this.done.splice(0, this.done.length - options.historyDepth)
        this.discardMaps()
      }
    } else {
      this.done[this.done.length - 1].push(ch)
    }
    this.undone.length = 0
    this.localStepCount++
    this.stateID = ++this.stateIDCounter

    this.lastAddedAt = now
  }

  forUnconfirmedChangesIn(array, f) {
    let curVersion = this.collab.version
    for (let i = array.length - 1; i >= 0; i--) {
      let set = array[i]
      for (let j = set.length - 1; j >= 0; j--) {
        let ch = set[j]
        if (ch.version <= curVersion) return
        f(ch)
      }
    }
  }

  forUnconfirmedChanges(f) {
    this.forUnconfirmedChangesIn(this.done, f)
    this.forUnconfirmedChangesIn(this.undone, f)
  }

  markConfirmed(version, data) {
    this.forUnconfirmedChanges(change => {
      let ahead = change.version - version
      if (ahead <= data.length) {
        let thisChange = data[ahead - 1]
        change.inverted = invertStep(thisChange.step, thisChange.doc, thisChange.map)
      }
    })
    for (let i = 0; i < data.length; i++) this.maps.push(data[i].map)
  }

  markForeignChanges(maps) {
    this.forUnconfirmedChanges(change => change.version += maps.length)
    for (let i = 0; i < maps.length; i++) this.maps.push(maps[i])
    this.stateID = ++this.stateIDCounter
    this.foreignStepCount += maps.length
  }

  mapChanges(changes) {
    let remap = new Remapping([], [], null, false)
    let uptoVersion = this.collab.version
    let tr = Tr(this.pm.doc)

    for (let i = changes.length - 1; i >= 0; i--) {
      let change = changes[i], result
      let ahead = change.version - this.collab.version
      if (ahead > 0) {
        let data = this.collab.unconfirmed[ahead - 1]
        let step = invertStep(data.step, data.doc, data.map)
        result = tr.step(mapStep(step, remap))
        remap.back.push(change.data.map)
      } else {
        while (uptoVersion > change.version)
          remap.back.push(this.maps[--uptoVersion - this.mapStartVersion])
        result = tr.step(mapStep(change.inverted, remap))
        remap.back.push(this.maps[--uptoVersion - this.mapStartVersion])
      }
      if (result) {
        remap.corresponds[remap.back.length - 1] = remap.forward.length
        remap.forward.push(result.map)
      }
    }
    return tr
  }

  move(from, to) {
    if (!from.length) return false
    let changes = from.pop()

    let transform = this.mapChanges(changes)

    let contra = this.captureChanges = []
    this.pm.apply(transform)
    this.captureChanges = null

    this.lastAddedAt = 0
    if (!contra.length) this.move(from, to)
    else if (to) to.push(contra)

    this.stateID = changes[0].stateID
    return changes.length
  }

  undo() {
    this.localStepCount -= this.move(this.done, this.undone)
  }

  redo() {
    this.localStepCount += this.move(this.undone, this.done)
  }

  discardMaps() {
    let doneOldest = this.done.length ? this.done[0][0].version : this.collab.version
    if (doneOldest < 0) doneOldest = this.collab.version
    let undoneOldest = this.undone.length ? this.undone[0][0].version : this.collab.version
    if (undoneOldest < 0) undoneOldest = this.collab.version
    let oldest = Math.min(undoneOldest, doneOldest)

    if (this.mapStartVersion < oldest) {
      this.maps.splice(0, oldest - this.mapStartVersion)
      this.mapStartVersion = oldest
    }
  }

  markState() {
    return {stateID: this.stateID, local: this.localStepCount, foreign: this.foreignStepCount}
  }

  isInState(state) {
    return this.foreignStepCount == state.foreign &&
      this.localStepCount == state.local &&
      this.stateID == state.stateID
  }

  backToState(state) {
    let over = this.localStepCount - state.local
    if (over <= 0) return

    let set = [], done = this.done.slice()
    while (over > 0 && done.length) {
      let tip = done.pop()
      if (tip.length > over) {
        done.push(tip.slice(0, tip.length - over))
        tip = tip.slice(tip.length - over)
      }
      over -= tip.length
      set = tip.concat(set)
    }
    if (set[0].stateID != state.stateID) return

    this.done = done
    this.move([set])
    this.undone.length = 0
    this.localStepCount = state.local

    return true
  }

  // FIXME add a mechanism to save memory on .maps by proactively
  // mapping changes in the history forward and discarding maps
}

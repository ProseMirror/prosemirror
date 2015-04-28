import {Tr, invertStep} from "../transform"

import {mapStep, Remapping} from "./rebase"

class Change {
  constructor(version, data) {
    this.version = version
    this.data = data
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
    this.undone = []
    this.lastAddedAt = 0
    this.captureChanges = null
  }

  mark() {}

  markStep(offset, data) {
    let ch = new Change(-offset, data)
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

    this.lastAddedAt = now
  }

  forUnconfirmedChangesIn(array, f) {
    for (let i = array.length - 1; i >= 0; i--) {
      let set = array[i]
      for (let j = set.length - 1; j >= 0; j--) {
        let ch = set[j]
        if (ch.version >= 0) return
        if (f(ch) === false) set.splice(j, 1)
      }
    }
  }

  forUnconfirmedChanges(f) {
    this.forUnconfirmedChangesIn(this.done, f)
    this.forUnconfirmedChangesIn(this.undone, f)
  }

  markConfirmed(version, amount) {
    this.forUnconfirmedChanges(change => {
      if (-change.version <= amount) {
        change.version = version - change.version
        change.inverted = invertStep(change.data.step, change.data.doc, change.data.map)
        change.data = null
      } else {
        change.version += amount
      }
    })
    for (let i = 0; i < amount; i++)
      this.maps.push(this.collab.unconfirmed[i].map)
  }

  markForeignChanges(maps, unconfirmed) {
    this.forUnconfirmedChanges(change => {
      let offset = -change.version + 1
      if (offset >= unconfirmed.length) return false
      change.data = unconfirmed[offset]
    })
    for (let i = 0; i < maps.length; i++) this.maps.push(maps[i])
  }

  mapChanges(changes) {
    let remap = new Remapping([], [], null, false)
    let uptoVersion = this.collab.version
    let tr = Tr(this.pm.doc)

    for (let i = changes.length - 1; i >= 0; i--) {
      let change = changes[i], result
      if (change.version < 0) {
        let step = invertStep(change.data.step, change.data.doc, change.data.map)
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

  unredo(un) {
    let source = un ? this.done : this.undone
    let dest = un ? this.undone : this.done

    if (!source.length) return false
    let changes = source.pop()

    let transform = this.mapChanges(changes)

    let contra = this.captureChanges = []
    this.pm.apply(transform)
    this.captureChanges = null

    if (contra.length) dest.push(contra)
    else this.unredo(un)
  }

  undo() { this.unredo(true) }

  redo() { this.unredo(false) }

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

  // FIXME add a mechanism to save memory on .maps by proactively
  // mapping changes in the history forward and discarding maps
}

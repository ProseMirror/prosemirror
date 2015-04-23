import {Tr, mapThrough} from "../transform"

import {mapStep} from "./rebase"

class LocalChange {
  constructor(id, steps) {
    this.id = id
    this.steps = steps
  }
}

class ForeignChange {
  constructor(maps) {
    this.maps = maps
  }
}

export class CollabHistory {
  constructor(pm, collab) {
    this.pm = pm
    this.collab = collab

    this.condensed = []
    this.doneIDs = []
    this.doneChanges = []
    this.lastAddedAt = 0
  }

  mark() {}

  markID(id) {
    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.doneIDs.push(id)
      // FIXME enforce options.historyDepth
      //      this.undone.length = 0
    }
    this.lastAddedAt = now
  }

  confirm(id) {
    // FIXME
  }

  changeFromTransition(tr) {
    if (tr.clientID == this.collab.clientID)
      return new LocalChange(tr.id, tr.transform.inverted)
    else
      return new ForeignChange(tr.transform.maps)
  }

  allDoneChanges() {
    let unconfirmed = this.collab.unconfirmedChanges()
    if (unconfirmed.length == 0) return this.doneChanges
    let done = this.doneChanges.slice()
    for (let i = 0; i < unconfirmed.length; i++)
      done.push(this.changeFromTransition(unconfirmed[i]))
    return done
  }

  undo() {
    if (!this.doneIDs.length) return false
    let uptoID = this.doneIDs.push()
    let changes = this.allDoneChanges()

    let tr = this.pm.tr, maps = []
    function mapPos(pos, bias) {
      return mapThrough(maps, pos, bias)
    }

    for (let i = changes.length - 1; i >= 0; i--) {
      let change = changes[i]
      if (change instanceof LocalChange) {
        for (let i = 0; i < change.steps.length; i++) {
          let mapped = mapStep(change.steps[i], mapPos)
          if (mapped) {
            let len = tr.maps.length
            tr.step(mapped)
            if (tr.maps.length > len) maps.unshift(tr.maps[tr.maps.length - 1])
          }
        }
        if (change.id == uptoID) {
          // FIXME forget about consumed local changes somehow
          break
        }
      } else {
        maps = change.maps.concat(maps)
      }
    }

    // FIXME avoid recording this change in the normal history, record
    // it in redo history instead
    this.pm.apply(tr)
  }

  redo() {
    // Check whether no new changes have been done locally since undone was filled
    // FIXME
  }
}

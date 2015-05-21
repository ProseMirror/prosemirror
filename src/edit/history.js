import {Transform, invertStep, mapStep, Remapping} from "../transform"

class InvertedStep {
  constructor(step, version) {
    this.step = step
    this.version = version
  }
}

class Branch {
  constructor(maxDepth) {
    this.maxDepth = maxDepth
    this.version = 0
    this.maps = []
    this.corresponds = Object.create(null)
    this.events = []
  }

  clear() {
    if (this.events.length) {
      this.maps.length = this.events.length = 0
      this.corresponds = Object.create(null)
    }
  }

  newEvent() {
    this.events.push([])
    // FIXME clean up unneeded maps
    while (this.events.length > this.maxDepth)
      this.events.shift()
  }

  addMap(map) {
    if (!this.empty()) {
      this.maps.push(map)
      this.version++
    }
  }

  empty() {
    return this.events.length == 0
  }

  addStep(step, map) {
    this.addMap(map)
    this.events[this.events.length - 1].push(new InvertedStep(step, this.version))
  }

  addTransform(transform) {
    for (let i = 0; i < transform.steps.length; i++) {
      let inverted = invertStep(transform.steps[i], transform.docs[i], transform.maps[i])
      this.addStep(inverted, transform.maps[i])
    }
  }

  popEvent(doc, allowCollapsing) {
    let event = this.events.pop()
    if (!event) return null

    let uptoVersion = this.version, uptoIndex = this.maps.length
    let remap, seenCorr = Object.create(null)
    let tr = new Transform(doc)

    const nextMap = () => {
      let found = this.corresponds[uptoVersion]
      let id = remap.addToFront(this.maps[--uptoIndex], seenCorr[uptoVersion])
      --uptoVersion
      if (found != null) seenCorr[found] = id
      return id
    }

    for (let i = event.length - 1; i >= 0; i--) {
      let invertedStep = event[i], step = invertedStep.step
      if (remap || !allowCollapsing || invertedStep.version != uptoVersion) {
        if (!remap) remap = new Remapping
        while (uptoVersion > invertedStep.version) nextMap()

        step = mapStep(step, remap)
        let result = step && tr.step(step)
        if (result) {
          this.maps.push(result.map)
          this.version++
          this.corresponds[this.version] = invertedStep.version
        }

        if (i > 0) {
          let corrID = nextMap()
          if (result) remap.addToBack(result.map, corrID)
        }
      } else {
        this.version--
        delete this.corresponds[this.version]
        this.maps.pop()
        tr.step(step)
        --uptoIndex
        --uptoVersion
      }
    }
    return tr
  }

  rebase(newMaps, rebasedTransform, positions) {
    let startVersion = this.version - positions.length

    // Update and clean up the events
    out: for (let i = this.events.length - 1; i >= 0; i--) {
      let event = this.events[i]
      for (let j = event.length - 1; j >= 0; j--) {
        let step = event[j]
        if (step.version <= startVersion) break out
        let off = positions[step.version - startVersion - 1]
        if (off == -1) {
          event.splice(j--, 1)
        } else {
          let inv = invertStep(rebasedTransform.steps[off], rebasedTransform.docs[off],
                               rebasedTransform.maps[off])
          event[j] = new InvertedStep(inv, startVersion + newMaps.length + off + 1)
        }
      }
    }

    // Sync the array of maps
    if (this.maps.length > positions.length)
      this.maps = this.maps.slice(0, startVersion).concat(newMaps).concat(rebasedTransform.maps)
    else
      this.maps = rebasedTransform.maps

    this.version = startVersion + newMaps.length + rebasedTransform.maps.length
  }
}

export class History {
  constructor(pm) {
    this.pm = pm

    this.done = new Branch(pm.options.historyDepth)
    this.undone = new Branch(pm.options.historyDepth)

    this.lastAddedAt = 0
    this.ignoreTransform = false

    this.allowCollapsing = true

    pm.on("transform", (transform, options) => this.recordTransform(transform, options))
  }

  recordTransform(transform, options) {
    if (this.ignoreTransform) return

    if (options.addToHistory == false) {
      for (let i = 0; i < transform.maps.length; i++) {
        let map = transform.maps[i]
        this.done.addMap(map)
        this.undone.addMap(map)
      }
      return
    }

    this.undone.clear()
    let now = Date.now(), target
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay)
      this.done.newEvent()

    this.done.addTransform(transform)
    this.lastAddedAt = now
  }

  undo() { return this.move(this.done, this.undone) }
  redo() { return this.move(this.undone, this.done) }

  move(from, to) {
    let transform = from.popEvent(this.pm.doc, this.allowCollapsing)
    if (!transform) return false

    this.ignoreTransform = true
    this.pm.apply(transform)
    this.ignoreTransform = false

    if (!transform.steps.length) return this.move(from, to)

    to.newEvent()
    to.addTransform(transform)
    this.lastAddedAt = 0

    return true
  }

  rebase(newMaps, rebasedTransform, positions) {
    this.done.rebase(newMaps, rebasedTransform, positions)
    this.undone.rebase(newMaps, rebasedTransform, positions)
  }

  // FIXME add a mechanism to save memory on .maps by proactively
  // mapping changes in the history forward and discarding maps
}

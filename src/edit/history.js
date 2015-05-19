import {Transform, invertStep, mapStep, Remapping} from "../transform"

class InvertedStep {
  constructor(step, version, id) {
    this.step = step
    this.version = version
    this.id = id
  }
}

class Branch {
  constructor(maxDepth) {
    this.maxDepth = maxDepth
    this.version = 0
    this.maps = []
    this.events = []
  }

  clear() {
    this.version = this.maps.length = this.events.length = 0
  }

  newEvent() {
    this.events.push([])
    while (this.events.length > this.maxDepth)
      this.events.shift()
  }

  addMap(map) {
    if (this.events.length && this.events[0].length) {
      this.maps.push(map)
      this.version++
    }
  }

  addStep(step, map, id) {
    this.addMap(map)
    this.events[this.events.length - 1].push(new InvertedStep(step, this.version, id))
  }

  popEvent(doc) {
    let event = this.events.pop()
    if (!event) return null

    let uptoVersion = this.version, uptoIndex = this.maps.length
    let remap
    let tr = new Transform(doc)

    for (let i = event.length - 1; i >= 0; i--) {
      let invertedStep = event[i], step = invertedStep.step
      if (remap || invertedStep.version != uptoVersion) {
        if (!remap) remap = new Remapping([], [], null, false)
        while (uptoVersion > invertedStep.version) {
          remap.back.push(this.maps[--uptoIndex])
          uptoVersion--
        }
        step = mapStep(step, remap)
        let result = step && tr.step(step)

        remap.back.push(this.maps[uptoIndex - 1])
        if (result) {
          remap.forward.push(result.map)
          remap.corresponds[remap.back.length - 1] = remap.forward.length - 1
          this.maps.push(result.map)
          this.version++
        }
      } else {
        this.version--
        this.maps.pop()
        tr.step(step)
      }
      --uptoIndex
      --uptoVersion
    }
    return tr
  }
}

export class History {
  constructor(pm) {
    this.pm = pm

    this.done = new Branch(pm.options.historyDepth)
    this.undone = new Branch(pm.options.historyDepth)
    this.id = 0

    this.lastAddedAt = 0
    this.ignoreTransform = false

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

    this.addTransform(this.done, transform)
    this.lastAddedAt = now
  }

  addTransform(target, transform) {
    for (let i = 0; i < transform.steps.length; i++) {
      let inverted = invertStep(transform.steps[i], transform.docs[i], transform.maps[i])
      target.addStep(inverted, transform.maps[i], this.id++)
    }
  }

  undo() { return this.move(this.done, this.undone) }
  redo() { return this.move(this.undone, this.done) }

  move(from, to) {
    let transform = from.popEvent(this.pm.doc)
    if (!transform) return false

    this.ignoreTransform = true
    this.pm.apply(transform)
    this.ignoreTransform = false

    if (!transform.steps.length) return this.move(from, to)

    to.newEvent()
    this.addTransform(to, transform)
    this.lastAddedAt = 0

    return true
  }

  // FIXME add a mechanism to save memory on .maps by proactively
  // mapping changes in the history forward and discarding maps
}

import {Transform, invertStep, mapStep, Remapping} from "../transform"

class InvertedStep {
  constructor(step, version, id) {
    this.step = step
    this.version = version
    this.id = id
  }
}

export class History {
  constructor(pm) {
    this.pm = pm

    this.maps = []
    this.version = 0

    this.done = []
    this.undone = []

    this.lastAddedAt = 0
    this.capture = null

    pm.on("transform", (transform, options) => this.recordTransform(transform, options))
  }

  recordTransform(transform, options) {
    if (options.addToHistory == false) {
      for (let i = 0; i < transform.maps.length; i++)
        this.maps.push(transform.maps[i])
      this.version += transform.steps.length
      return
    }

    let now = Date.now(), target
    if (this.capture) {
      target = this.capture
    } else if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push(target = [])
      while (this.done.length > this.pm.options.historyDepth)
        this.done.shift()
    } else {
      target = this.done[this.done.length - 1]
    }

    for (let i = 0; i < transform.steps.length; i++) {
      this.maps.push(transform.maps[i])
      this.version++
      let inverted = invertStep(transform.steps[i], transform.docs[i], transform.maps[i])
      target.push(new InvertedStep(inverted, this.version))
    }
    if (!this.capture) {
      this.undone.length = 0
      this.lastAddedAt = now
    }
  }

  undo() { this.move(this.done, this.undone) }
  redo() { this.move(this.undone, this.done) }

  move(from, to) {
    if (!from.length) return false
    let steps = from.pop()

    let {transform, synced} = this.mapStepsToCurrentVersion(steps)
    this.version -= synced
    this.maps.length -= synced

    let contra = this.capture = []
    this.pm.apply(transform)
    this.capture = null

    if (!contra.length) return this.move(from, to)

    to.push(contra)
    this.lastAddedAt = 0

    return true
  }

  mapStepsToCurrentVersion(steps) {
    let remap = new Remapping([], [], null, false)
    let uptoVersion = this.version, uptoIndex = this.maps.length
    let tr = new Transform(this.pm.doc)

    let synced = true, syncedSteps = 0
    for (let i = steps.length - 1; i >= 0; i--) {
      let invertedStep = steps[i], step = invertedStep.step
      if (!synced || invertedStep.version != uptoVersion) {
        synced = false
        while (uptoVersion > invertedStep.version) {
          remap.back.push(this.maps[--uptoIndex])
          uptoVersion--
        }
        step = mapStep(step, remap)
      } else {
        this.syncedSteps++
      }
      let result = step && tr.step(step)
      remap.back.push(this.maps[--uptoIndex])
      uptoVersion--
      if (result) {
        remap.forward.push(result.map)
        remap.corresponds[remap.back.length - 1] = remap.forward.length - 1
      }
    }
    return {transform: tr, synced: syncedSteps}
  }

  // FIXME add a mechanism to save memory on .maps by proactively
  // mapping changes in the history forward and discarding maps
}

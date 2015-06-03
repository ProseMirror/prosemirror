import {defineOption, eventMixin} from "../edit"
import {applyStep, mapStep, invertStep, Remapping, Transform, Step} from "../transform"

defineOption("collab", false, (pm, value, _, isInit) => {
  if (pm.mod.collab) {
    pm.mod.collab.detach()
    pm.mod.collab = null
  }

  if (value) {
    pm.mod.collab = new Collab(pm, value)
  }
})

class Collab {
  constructor(pm, options) {
    this.pm = pm
    this.options = options

    this.version = options.version || 0
    this.versionDoc = pm.doc

    this.unconfirmedSteps = []
    this.unconfirmedMaps = []

    pm.on("transform", this.onTransform = transform => {
      for (let i = 0; i < transform.steps.length; i++) {
        this.unconfirmedSteps.push(transform.steps[i])
        this.unconfirmedMaps.push(transform.maps[i])
      }
      this.signal("mustSend")
    })
    pm.on("beforeSetDoc", this.onSetDoc = () => {
      throw new Error("setDoc is not supported on a collaborative editor")
    })
    pm.history.allowCollapsing = false
  }

  detach() {
    this.pm.off("transform", this.onTransform)
    this.pm.off("beforeSetDoc", this.onSetDoc)
    this.pm.history.allowCollapsing = true
  }

  hasSendableSteps() {
    return this.unconfirmedSteps.length > 0
  }

  sendableSteps() {
    return {
      version: this.version,
      doc: this.pm.doc,
      steps: this.unconfirmedSteps.map(s => s.toJSON())
    }
  }

  confirmSteps(sendable) {
    this.unconfirmedSteps.splice(0, sendable.steps.length)
    this.unconfirmedMaps.splice(0, sendable.steps.length)
    this.version += sendable.steps.length
    this.versionDoc = sendable.doc
  }

  receive(steps) {
    let doc = this.versionDoc
    let maps = steps.map(json => {
      let step = Step.fromJSON(json)
      let result = applyStep(doc, step)
      doc = result.doc
      return result.map
    })
    this.version += steps.length
    this.versionDoc = doc

    let rebased = rebaseSteps(doc, maps, this.unconfirmedSteps, this.unconfirmedMaps)
    this.unconfirmedSteps = rebased.transform.steps.slice()
    this.unconfirmedMaps = rebased.transform.maps.slice()

    let sel = this.pm.selection
    this.pm.updateDoc(rebased.doc, rebased.mapping)
    this.pm.history.rebased(maps, rebased.transform, rebased.positions)
  }
}

eventMixin(Collab)

export function rebaseSteps(doc, forward, steps, maps) {
  let remap = new Remapping([], forward.slice())
  let transform = new Transform(doc)
  let positions = []

  for (let i = 0; i < steps.length; i++) {
    let step = mapStep(steps[i], remap)
    let result = step && transform.step(step)
    let id = remap.addToFront(maps[i].invert())
    if (result) {
      remap.addToBack(result.map, id)
      positions.push(transform.steps.length - 1)
    } else {
      positions.push(-1)
    }
  }
  return {doc: transform.doc, transform, mapping: remap, positions}
}

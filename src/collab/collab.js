import {defineOption, Range} from "../edit"
import {applyStep, mapStep, invertStep, Remapping, Transform} from "../transform"
import {stepToJSON, stepFromJSON} from "./json"

defineOption("collab", false, (pm, value, _, isInit) => {
  if (!isInit) throw new Error("Can't enable/disable collaboration in a running editor")
  if (!value) return

  pm.mod.collab = new Collab(pm, value)
  pm.history.allowCollapsing = false
})

class Collab {
  constructor(pm, options) {
    if (!options.channel)
      throw new Error("No communication channel provided to collab module")
    this.pm = pm
    this.options = options
    this.channel = options.channel

    this.version = options.version || 0
    this.versionDoc = pm.doc

    this.unconfirmedSteps = []
    this.unconfirmedMaps = []
    this.outOfSync = false
    this.sending = false

    pm.on("transform", transform => {
      for (let i = 0; i < transform.steps.length; i++) {
        this.unconfirmedSteps.push(transform.steps[i])
        this.unconfirmedMaps.push(transform.maps[i])
      }
      this.send()
    })
    pm.on("beforeSetDoc", () => {
      throw new Error("setDoc is not supported on a collaborative editor")
    })

    this.channel.listen(steps => this.receive(steps))
  }

  send() {
    if (this.outOfSync || this.sending || this.unconfirmedSteps.length == 0) return

    let amount = this.unconfirmedSteps.length
    let startVersion = this.version
    let startDoc = this.pm.doc
    this.sending = true
    this.channel.send(this.version, this.unconfirmedSteps.map(stepToJSON), (err, ok) => {
      this.sending = false
      if (err) {
        // FIXME error handling
      } else if (!ok) {
        if (startVersion == this.version)
          this.outOfSync = true
      } else {
        this.unconfirmedSteps.splice(0, amount)
        this.unconfirmedMaps.splice(0, amount)
        this.version += amount
        this.versionDoc = startDoc
      }
      this.send()
    })
  }

  receive(steps) {
    let doc = this.versionDoc
    let maps = steps.map(json => {
      let step = stepFromJSON(json)
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

    if (this.outOfSync) {
      this.outOfSync = false
      this.send()
    }
  }
}

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

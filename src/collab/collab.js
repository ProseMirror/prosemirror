import {defineOption, Range} from "../edit"
import {applyStep, mapStep, invertStep, Remapping} from "../transform"
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

    this.unconfirmed = []
    this.outOfSync = false
    this.sending = false

    pm.on("transform", transform => {
      let hist = this.pm.history, endID = hist.id
      for (let i = 0; i < transform.steps.length; i++) {
        let id = endID - (transform.steps.length - i)
        this.unconfirmed.push({step: transform.steps[i], map: transform.maps[i], id})
      }
      this.send()
    })

    this.channel.register(this)
  }

  send() {
    if (this.outOfSync || this.sending || this.unconfirmed.length == 0) return

    let amount = this.unconfirmed.length
    let startVersion = this.version
    let startDoc = this.pm.doc
    this.sending = true
    this.channel.send(this, this.version, this.unconfirmed.map(c => stepToJSON(c.step)), (err, ok) => {
      this.sending = false
      if (err) {
        // FIXME error handling
      } else if (!ok) {
        if (startVersion == this.version)
          this.outOfSync = true
      } else {
        this.unconfirmed = this.unconfirmed.slice(amount)
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
    let rebased = rebaseChanges(doc, maps, this.unconfirmed)
    let oldUnconfirmed = this.unconfirmed
    this.unconfirmed = rebased.data
    this.version += steps.length
    this.versionDoc = doc

    let sel = this.pm.selection
    // FIXME also map ranges. Add API to set doc and map tracked positions through map
    this.pm.updateInner(rebased.doc, new Range(rebased.mapping.map(sel.from).pos,
                                               rebased.mapping.map(sel.to).pos))
    this.pm.history.rebase(maps, rebased.inverted, unconfirmed)

    if (this.outOfSync) {
      this.outOfSync = false
      this.send()
    }
  }
}

export function rebaseSteps(doc, forward, stepData) {
  let remap = new Remapping([], forward.slice())
  for (let i = 0; i < stepData.length; i++) {
    let data = stepData[i]
    let step = mapStep(data.step, remap)
    let result = step && applyStep(doc, step)
    if (result) {
      rebased.push({step: step, map: result.map, id: data.id})
      inverted.push({step: invertStep(step, doc, result.map), map: result.map, id: data.id})
      doc = result.doc

      remap.corresponds[remap.back.length] = remap.forward.length
      remap.forward.push(result.map)
    }
    remap.back.push(data.map)
  }
  return {doc, data: rebased, inverted, mapping: remap}
}

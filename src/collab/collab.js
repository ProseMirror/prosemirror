import {defineOption, Range} from "../edit"
import {applyStep} from "../transform"
import {randomID, childID, nullID} from "./id"
import {stepToJSON, stepFromJSON} from "./json"
import {mergeTransitionSets, rebaseTransitions, remapping} from "./rebase"
import {Transition, VersionStore} from "./versions"
import {CollabHistory} from "./history"

defineOption("collab", false, (pm, value, _, isInit) => {
  if (!isInit) throw new Error("Can't enable/disable collaboration in a running editor")
  if (!value) return

  pm.mod.collab = new Collab(pm, value)
  pm.history = new CollabHistory(pm, pm.mod.collab)
})

class Collab {
  constructor(pm, options) {
    if (!options.channel)
      throw new Error("No communication channel provided to collab module")
    this.pm = pm
    this.options = options
    this.channel = options.channel
    this.clientID = options.clientID || randomID()
    this.versionID = this.confirmedID = options.rootID || nullID
    this.debounce = null

    this.toSend = []
    this.sending = false

    this.store = new VersionStore
    this.store.storeVersion(this.versionID, null, pm.doc)

    pm.on("transform", transform => {
      for (let i = 0; i < transform.steps.length; i++) {
        let id = randomID(), step = transform.steps[i]
        this.toSend.push({
          base: this.versionID,
          id: id,
          by: this.clientID,
          step: stepToJSON(step)
        })
        let newID = childID(this.versionID, id)
        this.store.storeVersion(newID, this.versionID, transform.docs[i + 1])
        let transition = new Transition(id, this.versionID, this.clientID, step, transform.maps[i])
        this.store.storeTransition(transition)
        this.versionID = newID
      }
      if (options.autoSend !== false) {
        window.clearTimeout(this.debounce)
        this.debounce = window.setTimeout(() => this.send(), 1000)
      }
    })

    this.channel.register(this.clientID, this)
  }

  send() {
    let len = this.toSend.length
    if (!this.sending && len > 0) {
      let data = this.toSend.slice()
      this.sending = true
      this.channel.send(this.clientID, data, this.versionID, err => {
        // FIXME error handling
        this.sending = false
        if (!err) this.toSend = this.toSend.slice(len)
        this.send()
      })
    }
  }

  receive(data) {
    let newTransitions = []
    let baseID = data[0].base

    // Pump changes into our version store
    for (let i = 0; i < data.length; i++) {
      let json = data[i]
      let base = this.store.getVersion(json.base)
      let step = stepFromJSON(json.step)
      let result = applyStep(base, step)
      let newID = childID(json.base, json.id)
      this.store.storeVersion(newID, json.base, result.doc)
      let tr = new Transition(json.id, json.base, json.by, step, result.map)
      newTransitions.push(tr)
      this.store.storeTransition(tr)
    }

    let knownTransitions = this.store.transitionsBetween(baseID, this.versionID)
    let transitions = mergeTransitionSets(knownTransitions, newTransitions)
    let rebased = rebaseTransitions(baseID, transitions, this.store)
    let sel = this.pm.selection

    let posMap = remapping(this.store, baseID, this.versionID, rebased.transitions)
    let newRange = new Range(posMap.map(sel.anchor).pos, posMap.map(sel.head).pos)
    this.pm.updateInner(rebased.doc, newRange)

    return this.versionID = rebased.id
  }

  unconfirmedTransitions() {
    return this.store.transitionsBetween(this.confirmedID, this.versionID)
  }

  confirm(id) {
    this.confirmedID = id
    this.store.cleanUp(id)
  }
}

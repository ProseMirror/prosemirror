import {defineOption, Range} from "../edit"
import {Tr} from "../transform"
import {randomID, childID, nullID} from "./id"
import {stepsToJSON, stepsFromJSON} from "./json"
import {mergeChangeSets, rebaseChanges, mapPosition} from "./rebase"
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
      let id = randomID()
      this.toSend.push({
        base: this.versionID,
        id: id,
        by: this.clientID,
        steps: stepsToJSON(transform.steps)
      })
      let newID = childID(this.versionID, id)
      this.store.storeVersion(newID, this.versionID, transform.doc)
      let transition = new Transition(id, this.versionID, this.clientID, transform)
      this.store.storeTransition(transition)
      this.versionID = newID

      if (options.autoSend !== false) {
        window.clearTimeout(this.debounce)
        this.debounce = window.setTimeout(() => this.send(), 1000)
      }

      this.pm.history.markTransition(transition)
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
      let transform = Tr(this.store.getVersion(json.base))
      stepsFromJSON(json.steps).forEach(s => transform.step(s))
      let tr = new Transition(json.id, json.base, json.by, transform)
      newTransitions.push(tr)
      let newID = childID(json.base, tr.id)
      this.store.storeVersion(newID, json.base, transform.doc)
      this.store.storeTransition(tr)
    }

    let knownChanges = this.store.transitionsBetween(baseID, this.versionID)
    let changes = mergeChangeSets(knownChanges, newTransitions)
    let rebased = rebaseChanges(baseID, changes, this.store)
    let sel = this.pm.selection
    let newRange = new Range(mapPosition(knownChanges, rebased.transitions, sel.anchor).pos,
                             mapPosition(knownChanges, rebased.transitions, sel.head).pos)
    this.pm.updateInner(rebased.doc, newRange)
    this.pm.history.rebasedTransitions(rebased.transitions)

    return this.versionID = rebased.id
  }

  unconfirmedChanges() {
    return this.store.transitionsBetween(this.confirmedID, this.versionID)
  }

  confirm(id) {
    this.pm.history.confirm(this.store.transitionsBetween(this.confirmedID, id))
    this.confirmedID = id
    this.store.cleanUp(id)
  }
}

import {defineOption, Range} from "../edit"
import {applyTransform} from "../transform"
import {randomID, xorIDs, nullID} from "./id"
import {paramsToJSON, paramsFromJSON} from "./json"
import {mergeChangeSets, rebaseChanges, mapPosition} from "./rebase"
import {Transition, VersionStore} from "./versions"

defineOption("collab", false, (pm, value, _, isInit) => {
  if (!isInit) throw new Error("Can't enable/disable collaboration in a running editor")
  if (!value) return

  pm.history = new CollabHistory(pm)
  pm.mod.collab = new Collab(pm, value)
})

class Collab {
  constructor(pm, options) {
    if (!options.channel)
      throw new Error("No communication channel provided to collab module")
    this.pm = pm
    this.options = options
    this.channel = options.channel
    this.clientID = randomID()
    this.versionID = options.rootID || nullID
    this.debounce = null

    this.toSend = []
    this.sending = false

    this.store = new VersionStore
    this.store.storeVersion(this.versionID, null, pm.doc)

    pm.on("transform", (params, result) => {
      let id = randomID()
      this.toSend.push({
        base: this.versionID,
        id: id,
        by: this.clientID,
        params: paramsToJSON(params)
      })
      let newID = xorIDs(this.versionID, id)
      this.store.storeVersion(newID, this.versionID, result.doc)
      let change = new Transition(id, this.versionID, this.clientID, params, result)
      this.store.storeTransition(change)
      this.versionID = newID

      if (options.autoSend !== false) {
        window.clearTimeout(this.debounce)
        this.debounce = window.setTimeout(() => this.send(), 200)
      }
    })

    this.channel.register(this.clientID, this)
  }

  send() {
    let len = this.toSend.length
    if (!this.sending && len > 0) {
      let data = this.toSend.slice()
      this.sending = true
      this.channel.send(this.clientID, data, err => {
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
      let params = paramsFromJSON(json.params)
      let result = applyTransform(this.store.getVersion(json.base), params)
      let tr = new Transition(json.id, json.base, json.by, params, result)
      newTransitions.push(tr)
      let newID = xorIDs(json.base, tr.id)
      this.store.storeVersion(newID, json.base, result.doc)
      this.store.storeTransition(tr)
    }

    let knownChanges = this.store.transitionsBetween(baseID, this.versionID)
    let changes = mergeChangeSets(knownChanges, newTransitions)
    let rebased = rebaseChanges(baseID, changes, this.store)
    let sel = this.pm.selection
    let newRange = new Range(mapPosition(knownChanges, rebased.forward, sel.anchor).pos,
                             mapPosition(knownChanges, rebased.forward, sel.head).pos)
    this.pm.updateInner(rebased.doc, newRange)
    this.versionID = rebased.id
  }
}

// FIXME implement
class CollabHistory {
  constructor(pm) {
    this.pm = pm
  }

  mark() {}

  undo() {}

  redo() {}
}

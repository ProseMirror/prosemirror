import {defineOption, Range} from "../edit"
import {applyTransform} from "../transform"
import {randomID, xorIDs, nullID} from "./id"
import {transitionToJSON, transitionFromJSON} from "./json"
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
        transition: transitionToJSON(ch.transition)
      })
      let newID = xorIDs(this.versionID, id)
      this.store.storeVersion(newID, this.versionID, result.doc)
      let change = new Transition(id, this.versionID, this.clientID, params, result)
      this.store.storeTransition(change)
      this.versionID = newID

      if (options.autoSend !== false) {
        window.clearTimeout(debounce)
        this.debounce = window.setTimeout(() => this.send(), 200)
      }
    })
  }

  send() {
    let len = this.toSend.length
    if (!this.sending && len == 0) {
      let data = this.changes.slice(this.sentUpto).map(ch => ())
      this.sending = true
      this.channel.send(data, err => {
        // FIXME error handling
        this.sending = false
        if (!err) this.toSend = this.toSend.slice(len)
        this.send()
      })
    }
  }

  receive(data) {
    let newChanges = []
    let baseID = data[0].base

    // Pump changes into our version store
    for (let i = 0; i < data.length; i++) {
      let params = transitionFromJSON(json.transition)
      let result = applyTransform(this.store.getVersion(json.base), change.params)
      let change = new Transition(json.id, json.base, json.by, params, result)
      newChanges.push(change)
      let newID = xorIDs(json.base, change.id)
      this.store.storeVersion(newID, json.base, result.doc)
      this.store.storeTransition(change)
    }

    let knownChanges = this.store.transitionsBetween(baseID, this.versionID)
    let changes = mergeChangeSets(knownChanges, newChanges)
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

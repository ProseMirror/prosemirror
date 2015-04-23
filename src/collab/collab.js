import {defineOption, Range} from "../edit"
import {Tr} from "../transform"
import {randomID, xorIDs, nullID} from "./id"
import {stepsToJSON, stepsFromJSON} from "./json"
import {mergeChangeSets, rebaseChanges, mapPosition} from "./rebase"
import {Transition, VersionStore} from "./versions"

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
    this.unconfirmed = []
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
      let newID = xorIDs(this.versionID, id)
      this.store.storeVersion(newID, this.versionID, transform.doc)
      let change = new Transition(id, this.versionID, this.clientID, transform)
      this.store.storeTransition(change)
      this.versionID = newID

      if (options.autoSend !== false) {
        window.clearTimeout(this.debounce)
        this.debounce = window.setTimeout(() => this.send(), 1000)
      }
      this.pm.history.storeTime(id, Date.now())
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
      let newID = xorIDs(json.base, tr.id)
      this.store.storeVersion(newID, json.base, transform.doc)
      this.store.storeTransition(tr)
    }

    let knownChanges = this.store.transitionsBetween(baseID, this.versionID)
    let changes = this.unconfirmed = mergeChangeSets(knownChanges, newTransitions)
    let rebased = rebaseChanges(baseID, changes, this.store)
    let sel = this.pm.selection
    let newRange = new Range(mapPosition(knownChanges, rebased.forward, sel.anchor).pos,
                             mapPosition(knownChanges, rebased.forward, sel.head).pos)
    this.pm.updateInner(rebased.doc, newRange)

    return this.versionID = rebased.id
  }

  confirm(id) {
    let cID = this.confirmedID;
    while (cID != id)
      cID = xorIDs(cID, this.unconfirmed.shift().id)
    this.confirmedID = id
    this.pm.history.confirm(id)
    this.store.cleanUp(id)
  }
}

class LocalChange {
  constructor(id, params) {
    this.id = id
    this.params = params
  }
}

class ForeignChange {
  constructor(map) {
    this.map = map
  }
}

class CollabHistory {
  constructor(pm, collab) {
    this.pm = pm
    this.collab = collab

    this.times = Object.create(null)
    this.done = []
    this.undone = []
    this.baseVersion = collab.versionID
  }

  mark() {}

  storeTime(id, time) {
    this.times[id] = time
  }

  confirm(id) {
    // FIXME
  }

  fullDone() {
    let unconfirmed = this.collab.unconfirmed
    if (unconfirmed.length == 0) return this.done
    let done = this.done.slice()
    for (let i = 0; i < unconfirmed.length; i++) {
      let tr = unconfirmed[i]
      if (tr.clientID == this.collab.clientID)
        done.push(new LocalChange(tr.id, tr.params))
      else if (last)
        done.push(new ForeignChange(tr.result))
    }
    return done
  }

  undo() {
    let maxPause = this.pm.options.historyEventDelay
    let done = this.fullDone()

    let end = done.length, last
    while (end && (done[end - 1] instanceof ForeignChange)) --end
    if (!end) return false
    let start = end, time = null
    for (let i = start - 1; i > 0; --i) {
      let next = done[i]
      if (next instanceof LocalChange) {
        let nextTime = this.times[next.id]
        if (time != null && time - maxPause > nextTime) break
        time = nextTime
        start = i
      }
    }
  }

  redo() {
    // Check whether no new changes have been done locally since undone was filled
    // FIXME
  }
}

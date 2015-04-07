import {xorIDs} from "./id"

export class Transition {
  constructor(id, baseID, clientID, params, result) {
    this.id = id
    this.baseID = baseID
    this.clientID = clientID
    this.params = params
    this.result = result
  }
}

function find(array, id) {
  for (let i = 0; i < array.length; i++) if (array[i].id == id) return array[i]
}

export class VersionStore {
  constructor() {
    this.versions = Object.create(null)
  }

  storeVersion(id, parentID, doc) {
    this.versions[id] = {doc: doc, parent: parentID, children: []}
  }

  getVersion(id) {
    return this.versions[id].doc
  }

  storeTransition(tr) {
    this.versions[tr.baseID].children.push(tr)
  }

  getTransition(oldID, changeID) {
    return find(this.versions[oldID].children, changeID)
  }

  getBackTransition(newID, changeID) {
    return this.getTransition(xorIDs(newID, changeID), changeID)
  }

  versionsAfter(baseID) {
    let found = [baseID], obj = Object.create(null)
    let followed = 0
    while (followed < found.length) {
      let next = found[followed++]
      obj[next] = true
      let transitions = this.versions[next].children
      if (transitions) for (let i = 0; i < transitions.length; i++)
        found.push(xorIDs(next, transitions[i].id))
    }
    return obj
  }

  cleanUp(baseID) {
    let keep = this.versionsAfter(baseID)
    for (var id in this.versions)
      if (!(id in keep)) delete this.versions[id]
  }

  transitionsBetween(oldID, newID) {
    let trs = [], id = newID, parent = this.versions[id].parent
    while (id != oldID) {
      let version = this.versions[parent]
      trs.unshift(find(version.children, xorIDs(id, parent)))
      id = parent
      parent = version.parent
    }
    return trs
  }
}

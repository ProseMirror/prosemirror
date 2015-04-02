import {doc, blockquote, h1, p, li, ol, ul, em, a, br} from "./build"
import Failure from "./failure"
import tests from "./tests"
import {cmpNode} from "./cmp"

import {Transition, VersionStore} from "../src/collab/versions"
import {mergeChangeSets, mapPosition, rebaseChanges} from "../src/collab/rebase"
import {nullID, xorIDs, randomID} from "../src/collab/id"
import {Pos} from "../src/model"
import {applyTransform} from "../src/transform"

function merge(name, known, add, expect) {
  tests["merge_changes_" + name] = function() {
    function parse(str) {
      return str.split(" ").map(s => { let m = s.match(/([a-z]+)(\d+)/); return {clientID: m[1], id: m[2]} })
    }
    function flat(lst) {
      return lst.map(c => c.clientID + c.id).join(" ")
    }
    let result = flat(mergeChangeSets(parse(known), parse(add)))
    if (result != expect)
      throw new Failure("Expected " + expect + " got " + result)
  }
}

merge("simple",
      "b1 b2", "a1 a2", "a1 a2 b1 b2")
merge("keep",
      "a1 a2", "b1 b2", "a1 a2 b1 b2")
merge("same_source",
      "a1 a2 a3 b1 b2", "a4 a5", "a1 a2 a3 a4 a5 b1 b2")

function mapObj(obj, f) {
  let result = {}
  for (let prop in obj) result[prop] = f(prop, obj[prop])
  return result
}

function fillTags(transform, tags) {
  return mapObj(transform, (key, val) => {
    if ((key == "pos" || key == "end") && typeof val == "string") {
      let m = val.match(/^(\w+)([-+]\d+)?$/)
      let pos = tags[m[1]]
      if (m[2]) pos = new Pos(pos.path, pos.offset + Number(m[2]))
      return pos
    } else {
      return val
    }
  })
}

function runRebase(startDoc, clients, result) {
  let store = new VersionStore
  store.storeVersion(nullID, null, startDoc)
  let allChanges = []
  clients.forEach((transforms, clientID) => {
    let doc = startDoc, id = nullID
    let tags = doc.tag
    let changes = transforms.map(params => {
      let tID = randomID()
      params = fillTags(params, tags)
      let result = applyTransform(doc, params)
      let tr = new Transition(tID, id, clientID, params, result)
      id = xorIDs(id, tID)
      store.storeVersion(id, tr.baseID, result.doc)
      store.storeTransition(tr)
      doc = result.doc
      tags = mapObj(tags, (_, value) => result.map(value))
      return tr
    })
    allChanges = mergeChangeSets(allChanges, changes)
  })

  let rebased = rebaseChanges(nullID, allChanges, store)
  cmpNode(rebased.doc, result)
}

function rebase(name, startDoc, ...clients) {
  let result = clients.pop()
  tests["rebase_" + name] = () => runRebase(startDoc, clients, result)
}

rebase("type_simple",
       doc(p("h<1>ell<2>o")),
       [{name: "insertText", pos: "1", text: "X"}],
       [{name: "insertText", pos: "2", text: "Y"}],
       doc(p("hXellYo")))

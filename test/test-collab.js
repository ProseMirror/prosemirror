import {doc, blockquote, h1, p, li, ol, ul, em, a, br} from "./build"
import Failure from "./failure"
import tests from "./tests"
import {cmpNode, cmpStr} from "./cmp"

import {Transition, VersionStore} from "../src/collab/versions"
import {mergeChangeSets, mapPosition, rebaseChanges} from "../src/collab/rebase"
import {nullID, xorIDs, randomID} from "../src/collab/id"
import {Pos, style} from "../src/model"
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
  for (let tag in startDoc.tag) {
    let mapped = mapPosition([], rebased.forward, startDoc.tag[tag])
    let expected = result.tag[tag]
    if (mapped.deleted) {
      if (expected)
        throw new Failure("Tag " + tag + " was unexpectedly deleted")
    } else {
      if (!expected)
        throw new Failure("Tag " + tag + " is not actually deleted")
      cmpStr(mapped.pos, expected, tag)
    }
  }
}

function rebase(name, startDoc, ...clients) {
  let result = clients.pop()
  tests["rebase_" + name] = () => runRebase(startDoc, clients, result)
}

function permute(array) {
  if (array.length < 2) return [array]
  let result = []
  for (let i = 0; i < array.length; i++) {
    let others = permute(array.slice(0, i).concat(array.slice(i + 1)))
    for (let j = 0; j < others.length; j++)
      result.push([array[i]].concat(others[j]))
  }
  return result
}

function rebase$(name, startDoc, ...clients) {
  let result = clients.pop()
  tests["rebase_" + name] = () => {
    permute(clients).forEach(clients => runRebase(startDoc, clients, result))
  }
}

rebase$("type_simple",
        doc(p("h<1>ell<2>o")),
        [{name: "insertText", pos: "1", text: "X"}],
        [{name: "insertText", pos: "2", text: "Y"}],
        doc(p("hX<1>ellY<2>o")))

rebase$("type_simple_multiple",
        doc(p("h<1>ell<2>o")),
        [{name: "insertText", pos: "1", text: "X"},
         {name: "insertText", pos: "1", text: "Y"},
         {name: "insertText", pos: "1", text: "Z"}],
        [{name: "insertText", pos: "2", text: "U"},
         {name: "insertText", pos: "2", text: "V"}],
        doc(p("hXYZ<1>ellUV<2>o")))

rebase$("type_simple",
        doc(p("h<1>ell<2>o")),
        [{name: "insertText", pos: "2", text: "Y"}],
        [{name: "insertText", pos: "1", text: "X"}],
        doc(p("hX<1>ellY<2>o")))

rebase$("type_simple_multiple",
        doc(p("h<1>ell<2>o")),
        [{name: "insertText", pos: "2", text: "U"},
         {name: "insertText", pos: "2", text: "V"}],
        [{name: "insertText", pos: "1", text: "X"},
         {name: "insertText", pos: "1", text: "Y"},
         {name: "insertText", pos: "1", text: "Z"}],
        doc(p("hXYZ<1>ellUV<2>o")))

rebase$("type_three",
        doc(p("h<1>ell<2>o th<3>ere")),
        [{name: "insertText", pos: "1", text: "X"}],
        [{name: "insertText", pos: "2", text: "Y"}],
        [{name: "insertText", pos: "3", text: "Z"}],
        doc(p("hX<1>ellY<2>o thZ<3>ere")))

rebase$("wrap",
        doc(p("<1>hell<2>o<3>")),
        [{name: "insertText", pos: "2", text: "X"}],
        [{name: "wrap", pos: "1", end: "3", type: "blockquote"}],
        doc(blockquote(p("<1>hellX<2>o<3>"))))

rebase$("delete",
        doc(p("hello<1> wo<2>rld<3>!")),
        [{name: "replace", pos: "1", end: "3"}],
        [{name: "insertText", pos: "2", text: "X"}],
        doc(p("hello<1><3>!")))

rebase("delete_twice",
       doc(p("hello<1> wo<2>rld<3>!")),
       [{name: "replace", pos: "1", end: "3"}],
       [{name: "replace", pos: "1", end: "3"}],
       doc(p("hello<1><3>!")))

rebase$("join",
        doc(ul(li(p("one")), li(p("<1>tw<2>o")))),
        [{name: "insertText", pos: "2", text: "A"}],
        [{name: "join", pos: "1"}],
        doc(ul(li(p("one"), p("<1>twA<2>o")))))

rebase$("style",
        doc(p("hello <1>wo<2>rld<3>")),
        [{name: "addStyle", style: style.em, pos: "1", end: "3"}],
        [{name: "insertText", pos: "2", text: "_"}],
        doc(p("hello <1>", em("wo_<2>rld<3>"))))

rebase("style_unstyle",
       doc(p("hello <1>world<2>")),
       [{name: "addStyle", style: style.em, pos: "1", end: "2"}],
       [{name: "removeStyle", style: style.em, pos: "1", end: "2"}],
       doc(p("hello <1>world<2>")))

rebase("unstyle_style",
       doc(p("hello ", em("<1>world<2>"))),
       [{name: "removeStyle", style: style.em, pos: "1", end: "2"}],
       [{name: "addStyle", style: style.em, pos: "1", end: "2"}],
       doc(p("hello ", em("<1>world<2>"))))

rebase("replace_nested",
       doc(p("b<before>efore"), blockquote(ul(li(p("o<1>ne")), li(p("t<2>wo")), li(p("thr<3>ee")))), p("a<after>fter")),
       [{name: "replace", pos: "1", end: "3",
         source: doc(p("a"), blockquote(p("b")), p("c")), from: new Pos([0], 1), to: new Pos([2], 0)}],
       [{name: "insertText", pos: "2", text: "ayay"}],
       doc(p("b<before>efore"), blockquote(ul(li(p("o")))), blockquote(p("b")), p("<1><3>ee"), p("a<after>fter")))

rebase$("map_through_insert",
        doc(p("X<1>X<2>X")),
        [{name: "insertText", pos: "1", text: "hello"}],
        [{name: "insertText", pos: "2", text: "goodbye"},
         {name: "replace", pos: "2-6", end: "2-3"}],
        doc(p("Xhello<1>Xgbye<2>X")))

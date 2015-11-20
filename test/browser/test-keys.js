import {namespace} from "./def"
import {doc, p, ul, li, pre} from "../build"
import {cmp, cmpNode, is} from "../cmp"
import {defTest} from "../tests"

import {dispatchKey} from "../../src/edit/input"
import {Keymap} from "../../src/edit/keys"
import {Pos} from "../../src/model"

function trace(prop) { return pm => pm.mod[prop] = (pm.mod[prop] || 0) + 1 }

const fallthrough = new Keymap({
  "Ctrl-A": trace("a")
})

const extraMap = new Keymap({
  "'B'": trace("b"),
  "Ctrl-X C": trace("c")
}, {fallthrough: fallthrough})

const test = namespace("keys", {
  doc: doc(p("foo"))
})

const event = {preventDefault: () => null}
function dispatch(pm, key) { dispatchKey(pm, key, event) }

test("basic", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "'B'")
  dispatch(pm, "'B'")
  cmp(pm.mod.b, 2)
})
  
test("fallthrough", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "Ctrl-A")
  dispatch(pm, "Ctrl-A")
  cmp(pm.mod.a, 2)
})

test("multi", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "C")
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "C")
  cmp(pm.mod.c, 2)
})

test("addKeymap", pm => {
  pm.addKeymap(extraMap)
  let map = new Keymap({"Ctrl-A": trace("a2")})
  pm.addKeymap(map, 10)
  dispatch(pm, "Ctrl-A")
  cmp(pm.mod.a, undefined)
  cmp(pm.mod.a2, 1)
  pm.removeKeymap(map)
  dispatch(pm, "Ctrl-A")
  cmp(pm.mod.a, 1)
  cmp(pm.mod.a2, 1)
})

test("addKeymap_bottom", pm => {
  pm.addKeymap(extraMap)
  let mapTop = new Keymap({"Ctrl-A": trace("a2")})
  let mapBot = new Keymap({"Ctrl-A": trace("a3"), "Ctrl-D": trace("d")})
  pm.addKeymap(mapTop, 10)
  pm.addKeymap(mapBot, 60)
  dispatch(pm, "Ctrl-A")
  cmp(pm.mod.a2, 1)
  cmp(pm.mod.a3, undefined)
  dispatch(pm, "Ctrl-D")
  cmp(pm.mod.d, 1)
  pm.removeKeymap(mapBot)
  dispatch(pm, "Ctrl-D")
  cmp(pm.mod.d, 1)
})

test("multiBindings", pm => {
  dispatch(pm, "Enter")
  cmpNode(pm.doc, doc(pre("\nabc"), ul(li(p("def"))), p("foo")))
  pm.setSelection(new Pos([1, 0, 0], 3))
  dispatch(pm, "Enter")
  cmpNode(pm.doc, doc(pre("\nabc"), ul(li(p("def")), li(p())), p("foo")))
  dispatch(pm, "Enter")
  cmpNode(pm.doc, doc(pre("\nabc"), ul(li(p("def"))), p(), p("foo")))
  pm.setSelection(new Pos([3], 1))
  dispatch(pm, "Enter")
  cmpNode(pm.doc, doc(pre("\nabc"), ul(li(p("def"))), p(), p("f"), p("oo")))
}, {
  doc: doc(pre("abc"), ul(li(p("def"))), p("foo"))
})

defTest("keys_add_inconsistent", () => {
  let map = new Keymap({"Ctrl-A": "foo", "Ctrl-B Ctrl-C": "quux"})
  try {
    map.addBinding("Ctrl-A", "bar")
    is(false)
  } catch (e) { if (!/Inconsistent/.test(e.toString())) throw e }
  try {
    map.addBinding("Ctrl-A Ctrl-X", "baz")
    is(false)
  } catch (e) { if (!/Inconsistent/.test(e.toString())) throw e }
  try {
    map.addBinding("Ctrl-B", "bak")
    is(false)
  } catch (e) { if (!/Inconsistent/.test(e.toString())) throw e }
})

defTest("keys_add_consistent", () => {
  let map = new Keymap({"Ctrl-A Ctrl-B": "foo", "Ctrl-A Ctrl-C": "bar"})
  map.removeBinding("Ctrl-A Ctrl-B")
  map.removeBinding("Ctrl-A Ctrl-C")
  map.addBinding("Ctrl-A", "quux")
})

import {namespace, dispatch} from "./def"
import {doc, p} from "../build"
import {cmp, is} from "../cmp"
import {defTest} from "../tests"

import {Keymap} from "../../edit"

function trace(prop) { return pm => pm.cached[prop] = (pm.cached[prop] || 0) + 1 }

const extraMap = new Keymap({
  "'B'": trace("b"),
  "Ctrl-X C": trace("c"),
  "Ctrl-A": trace("a")
})

const test = namespace("keys", {
  doc: doc(p("foo"))
})

test("basic", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "'B'")
  dispatch(pm, "'B'")
  cmp(pm.cached.b, 2)
})

test("multi", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "C")
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "C")
  cmp(pm.cached.c, 2)
})

test("addKeymap", pm => {
  pm.addKeymap(extraMap)
  let map = new Keymap({"Ctrl-A": trace("a2")})
  pm.addKeymap(map, 10)
  dispatch(pm, "Ctrl-A")
  cmp(pm.cached.a, undefined)
  cmp(pm.cached.a2, 1)
  pm.removeKeymap(map)
  dispatch(pm, "Ctrl-A")
  cmp(pm.cached.a, 1)
  cmp(pm.cached.a2, 1)
})

test("addKeymap_bottom", pm => {
  pm.addKeymap(extraMap)
  let mapTop = new Keymap({"Ctrl-A": trace("a2")})
  let mapBot = new Keymap({"Ctrl-A": trace("a3"), "Ctrl-D": trace("d")})
  pm.addKeymap(mapTop, 10)
  pm.addKeymap(mapBot, 60)
  dispatch(pm, "Ctrl-A")
  cmp(pm.cached.a2, 1)
  cmp(pm.cached.a3, undefined)
  dispatch(pm, "Ctrl-D")
  cmp(pm.cached.d, 1)
  pm.removeKeymap(mapBot)
  dispatch(pm, "Ctrl-D")
  cmp(pm.cached.d, 1)
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

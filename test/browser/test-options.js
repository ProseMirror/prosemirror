import {defineOption} from "../../src/edit"

import {namespace} from "./def"
import {cmp} from "../cmp"

const test = namespace("options")

defineOption("testOption", "default", (pm, val, oldVal, isInit) => {
  pm.mod.testOption = {val, oldVal, isInit}
})

test("given_value", pm => {
  cmp(pm.mod.testOption.val, "given")
  cmp(pm.getOption("testOption"), "given")
  cmp(pm.mod.testOption.isInit, true)
  cmp(pm.mod.testOption.oldVal, null)
}, {testOption: "given"})

test("default_value", pm => {
  cmp(pm.mod.testOption.val, "default")
  cmp(pm.getOption("testOption"), "default")
  cmp(pm.mod.testOption.isInit, true)
})

test("updated_value", pm => {
  pm.setOption("testOption", "updated")
  cmp(pm.mod.testOption.val, "updated")
  cmp(pm.getOption("testOption"), "updated")
  cmp(pm.mod.testOption.isInit, false)
  cmp(pm.mod.testOption.oldVal, "default")
})

defineOption("testOptionNoInit", "default", pm => {
  pm.mod.testOptionNoInitUpdated = true
}, false)

test("no_init", pm => {
  cmp(pm.mod.testOptionNoInitUpdated, undefined)
  pm.setOption("testOptionNoInit", "updated")
  cmp(pm.mod.testOptionNoInitUpdated, true)
})

test("invalid_option", pm => {
  var error
  try {
    pm.setOption("doesNotExist", "isInvalid")
  } catch (e) {
    error = e
  }
  cmp(pm.getOption("doesNotExist"), undefined)
  cmp(error.message, "Option 'doesNotExist' is not defined")
})

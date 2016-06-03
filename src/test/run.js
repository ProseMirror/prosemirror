const {Failure} = require("./failure")
require("./all")
require("source-map-support").install()

const {tests, filter} = require("./tests")

let fail = 0, ran = 0

// declare global: process
let filters = process.argv.slice(2)

for (let name in tests) {
  if (!filter(name, filters)) continue
  ++ran
  try {
    tests[name]()
  } catch(e) {
    ++fail
    if (e instanceof Failure)
      console["log"](name + ": " + e)
    else
      console["log"](name + ": " + (e.stack || e))
  }
}

console["log"]((fail ? "\n" : "") + ran + " test ran. " + (fail ? fail + " failures." : "All passed."))
process.exit(fail ? 1 : 0)

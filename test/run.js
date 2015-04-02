import Failure from "./failure"

let fail = 0, ran = 0

let filter = process.argv[2]

import tests from "./tests"

import "./test-parse"
import "./test-slice"
import "./test-replace"
import "./test-style"
import "./test-block"
import "./test-inline"
import "./test-dom"
import "./test-collab"

for (let name in tests) {
  if (filter && name.indexOf(filter) == -1) continue
  ++ran
  try {
    tests[name]()
  } catch(e) {
    ++fail
    if (e instanceof Failure)
      console.log(name + ": " + e)
    else
      console.log(name + ": " + (e.stack || e))
  }
}

console.log((fail ? "\n" : "") + ran + " test ran. " + (fail ? fail + " failures." : "All passed."))
process.exit(fail ? 1 : 0)

import Failure from "./failure"

let fail = 0, ran = 0

let filter = process.argv[2]

function run(tests) {
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
}

import slice from "./test-slice"
run(slice)
import replace from "./test-replace"
run(replace)
import style from "./test-style"
run(style)

console.log((fail ? "\n" : "") + ran + " test ran. " + (fail ? fail + " failures." : "All passed."))
process.exit(fail ? 1 : 0)

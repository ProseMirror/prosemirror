import {createDoc} from "./generate"
import {tests, runCase, clearCase} from "./transforms"
import {allPositions} from "./pos"

function oneDoc(fuel) {
  let doc = createDoc(fuel)
  let all = allPositions(doc), allBlock = allPositions(doc, true)
  console.log("Starting new doc")
  for (var name in tests) {
    console.log("Running " + name)
    tests[name](doc, all, allBlock)
  }
}

let a2 = process.argv[2], a3 = process.argv[3]
if (a2 == "--run") {
  runCase(Number(a3))
} else if (a2 == "--del") {
  clearCase(Number(a3))
} else {
  for (let fuel = .2;; fuel = Math.min(1, fuel + .01)) oneDoc(fuel)
}

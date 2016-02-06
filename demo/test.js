import {tests, filter} from "../test/tests"
import {Failure} from "../test/failure"
import "../test/all"
import "../test/browser/all"

let gen = 0

function runTests() {
  let filters = document.location.hash.slice(1).split(",")
  let myGen = ++gen
  let runnable = []
  for (let name in tests) if (filter(name, filters)) runnable.push(name)

  document.querySelector("#output").textContent = ""

  function run(i) {
    let t0 = Date.now()
    for (;; i++) {
      if (gen != myGen) return
      if (i == runnable.length) return finish()
      let name = runnable[i]
      document.querySelector("#info").textContent = (i + 1) + " of " + runnable.length + " tests"
      document.querySelector("#status").textContent = "Running " + name
      document.querySelector("#measure").style.width = (((i + 1) / runnable.length) * 100) + "%"

      try {
        tests[name]()
      } catch(e) {
        logFailure(name, e)
      }
      if (Date.now() > t0 + 200) {
        setTimeout(() => run(i + 1), 50)
        return
      }
    }
  }

  let failed = 0

  function finish() {
    document.querySelector("#info").textContent = "Ran " + runnable.length + " tests"
    let status = document.querySelector("#status")
    status.textContent = failed ? failed + " failed" : "All passed"
    status.className = failed ? "bad" : "good"
  }

  function logFailure(name, err) {
    ++failed
    let elt = document.querySelector("#output").appendChild(document.createElement("pre"))
    let nm = elt.appendChild(document.createElement("a"))
    nm.className = "bad"
    nm.href= "#" + name
    nm.textContent = name
    elt.appendChild(document.createTextNode(": " + err))
    if (!(err instanceof Failure))
      console.log(name + ": " + (err.stack || err))
  }

  setTimeout(() => run(0), 50)
}

runTests()

addEventListener("hashchange", runTests)

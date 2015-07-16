import {Pos} from "../src/model"

import {Failure} from "./failure"
import {defTest} from "./tests"

function p(...args) {
  let offset = args.pop()
  return new Pos(args, offset)
}

function sn(n) { return n == 0 ? 0 : n < 0 ? -1 : 1 }

let id = 0
function cmp(a, b, expected) {
  defTest("pos_cmp_" + (id++), () => {
    let result = sn(a.cmp(b))
    if (result != expected)
      throw new Failure("Positions " + a + " and " + b + " should compare as " + expected + " but yield " + result)
    let inverse = sn(b.cmp(a))
    if (inverse != -expected)
      throw new Failure("Positions " + b + " and " + a + " should compare as " + -expected + " but yield " + inverse + " (flipped)")
  })
}

cmp(p(0, 0), p(0, 0), 0)
cmp(p(1, 1), p(1, 1), 0)
cmp(p(0, 0, 1, 0), p(0, 0, 1), 1)
cmp(p(0, 0, 1, 0), p(0, 0, 2), -1)
cmp(p(1), p(0, 0), 1)
cmp(p(1), p(0, 1000), 1)
cmp(p(1), p(1, 0), -1)

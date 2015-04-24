import {randomID, xorIDs, rotateIDLeft, rotateIDRight, childID, parentID, changeID, nullID} from "../src/collab/id"

import Failure from "./failure"
import {defTest} from "./tests"

function assert(cond, msg) { if (!cond) throw new Failure(msg) }

defTest("id_random", () => {
  assert(randomID() != randomID(), "not static")
})

defTest("id_xor", () => {
  let a = randomID(), b = randomID()
  assert(xorIDs(a, nullID) == a, "xor 0")
  assert(xorIDs(nullID, a) == a, "xor 0 reverse")
  assert(xorIDs(a, b) == xorIDs(b, a), "xor commutes")
})

defTest("id_rotate", () => {
  let a = randomID()
  assert(a != rotateIDLeft(a), "rotate does something")
  for (let i = 0; i < 50; i++) {
    let rotated = a
    for (let j = 0; j < i; j++) rotated = rotateIDLeft(rotated)
    for (let j = 0; j < i; j++) rotated = rotateIDRight(rotated)
    assert(a == rotated, "rotate returns " + i)
  }
})

defTest("id_parent", () => {
  let parent = randomID(), change = randomID()
  let child = childID(parent, change)
  assert(parentID(child, change) == parent, "child invertable")
  assert(changeID(child, parent) == change, "recover change id")
})

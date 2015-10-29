import {Pos} from "./pos"
import {sameStyles} from "./style"

export function findDiffStart(a, b, pathA = [], pathB = []) {
  let offset = 0
  for (let i = 0;; i++) {
    if (i == a.length || i == b.length) {
      if (a.length == b.length) return null
      break
    }
    let childA = a.child(i), childB = b.child(i)
    if (childA == childB) {
      offset += a.isTextblock ? childA.offset : 1
      continue
    }

    if (!childA.sameMarkup(childB)) break

    if (a.isTextblock) {
      if (!sameStyles(childA.styles, childB.styles)) break
      if (childA.isText && childA.text != childB.text) {
        for (let j = 0; childA.text[j] == childB.text[j]; j++)
          offset++
        break
      }
      offset += childA.offset
    } else {
      let inner = findDiffStart(childA, childB, pathA.concat(i), pathB.concat(i))
      if (inner) return inner
      offset++
    }
  }
  return {a: new Pos(pathA, offset), b: new Pos(pathB, offset)}
}

export function findDiffEnd(a, b, pathA = [], pathB = []) {
  let iA = a.length, iB = b.length
  let offset = 0

  for (;; iA--, iB--) {
    if (iA == 0 || iB == 0) {
      if (iA == iB) return null
      break
    }
    let childA = a.child(iA - 1), childB = b.child(iB - 1)
    if (childA == childB) {
      offset += a.isTextblock ? childA.offset : 1
      continue
    }

    if (!childA.sameMarkup(childB)) break

    if (a.isTextblock) {
      if (!sameStyles(childA.styles, childB.styles)) break

      if (childA.isText && childA.text != childB.text) {
        let same = 0, minSize = Math.min(childA.text.length, childB.text.length)
        while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
          same++
          offset++
        }
        break
      }
      offset += childA.offset
    } else {
      let inner = findDiffEnd(childA, childB, pathA.concat(iA - 1), pathB.concat(iB - 1))
      if (inner) return inner
      offset++
    }
  }
  return {a: new Pos(pathA, a.maxOffset - offset),
          b: new Pos(pathB, b.maxOffset - offset)}
}

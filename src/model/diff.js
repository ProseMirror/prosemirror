import {Pos} from "./pos"
import {sameStyles} from "./style"

export function findDiffStart(a, b, path = []) {
  let offset = 0
  for (let i = 0;; i++) {
    if (i == a.chunkLength || i == b.chunkLength) {
      if (a.chunkLength == b.chunkLength) return null
      break
    }
    let childA = a.chunkAt(i), childB = b.chunkAt(i)
    if (childA == childB) {
      offset += childA.width
      continue
    }

    if (!childA.sameMarkup(childB) || !sameStyles(childA.marks, childB.marks)) break

    if (childA.isText && childA.text != childB.text) {
      for (let j = 0; childA.text[j] == childB.text[j]; j++)
        offset++
      break
    }

    if (childA.size || childB.size) {
      path.push(offset)
      let inner = findDiffStart(childA.content, childB.content, path)
      if (inner) return inner
      path.pop()
    }
    offset += childA.width
  }
  return new Pos(path, offset)
}

export function findDiffEnd(a, b, pathA = [], pathB = []) {
  let iA = a.chunkLength, iB = b.chunkLength
  let offA = a.size, offB = b.size

  for (;; iA--, iB--) {
    if (iA == 0 || iB == 0) {
      if (iA == iB) return null
      break
    }
    let childA = a.chunkAt(iA - 1), childB = b.chunkAt(iB - 1)
    if (childA == childB) {
      offA -= childA.width; offB -= childB.width
      continue
    }

    if (!childA.sameMarkup(childB) || !sameStyles(childA.marks, childB.marks)) break

    if (childA.isText && childA.text != childB.text) {
      let same = 0, minSize = Math.min(childA.text.length, childB.text.length)
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++; offA--; offB--
      }
      break
    }
    offA -= childA.width; offB -= childB.width
    if (childA.size || childB.size) {
      pathA.push(offA); pathB.push(offB)
      let inner = findDiffEnd(childA.content, childB.content, pathA, pathB)
      if (inner) return inner
      pathA.pop(); pathB.pop()
    }
  }
  return {a: new Pos(pathA, offA), b: new Pos(pathB, offB)}
}

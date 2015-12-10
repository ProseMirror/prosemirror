import {Pos} from "./pos"

// :: (Node, Node) → ?Pos
// Find the first position at which nodes `a` and `b` differ, or
// `null` if they are the same.
export function findDiffStart(a, b, path = []) {
  let iA = a.iter(), iB = b.iter(), offset = 0
  for (;;) {
    if (iA.atEnd() || iB.atEnd()) {
      if (a.size == b.size) return null
      break
    }

    let childA = iA.next(), childB = iB.next()
    if (childA == childB) { offset += childA.width; continue }

    if (!childA.sameMarkup(childB)) break

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

// :: (Node, Node) → ?{a: Pos, b: Pos}
// Find the first position, searching from the end, at which nodes `a`
// and `b` differ, or `null` if they are the same. Since this position
// will not be the same in both nodes, an object with two separate
// positions is returned.
export function findDiffEnd(a, b, pathA = [], pathB = []) {
  let iA = a.reverseIter(), iB = b.reverseIter()
  let offA = a.size, offB = b.size

  for (;;) {
    if (iA.atEnd() || iB.atEnd()) {
      if (a.size == b.size) return null
      break
    }
    let childA = iA.next(), childB = iB.next()
    if (childA == childB) {
      offA -= childA.width; offB -= childB.width
      continue
    }

    if (!childA.sameMarkup(childB)) break

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

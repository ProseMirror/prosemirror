// :: (Node, Node) → ?number
// Find the first position at which nodes `a` and `b` differ, or
// `null` if they are the same.
export function findDiffStart(a, b, pos = 0) {
  let curA = a.cursor(), curB = b.cursor()
  for (;;) {
    if (curA.atEnd() || curB.atEnd())
      return a.size == b.size ? null : pos

    let childA = curA.next(), childB = curB.next()
    if (childA == childB) { pos += childA.size; continue }

    if (!childA.sameMarkup(childB)) return pos

    if (childA.isText && childA.text != childB.text) {
      for (let j = 0; childA.text[j] == childB.text[j]; j++)
        pos++
      return pos
    }

    if (childA.content.size || childB.content.size) {
      let inner = findDiffStart(childA.content, childB.content, pos + 1)
      if (inner != null) return inner
    }
    pos += childA.size
  }
}

// :: (Node, Node) → ?{a: number, b: number}
// Find the first position, searching from the end, at which nodes `a`
// and `b` differ, or `null` if they are the same. Since this position
// will not be the same in both nodes, an object with two separate
// positions is returned.
export function findDiffEnd(a, b, posA = a.size, posB = b.size) {
  let curA = a.cursor(a.size), curB = b.cursor(b.size)

  for (;;) {
    if (curA.atStart() || curB.atStart())
      return a.size == b.size ? null : {a: posA, b: posB}

    let childA = curA.prev(), childB = curB.prev()
    if (childA == childB) {
      posA -= childA.size; posB -= childB.size
      continue
    }

    if (!childA.sameMarkup(childB)) return {a: posA, b: posB}

    if (childA.isText && childA.text != childB.text) {
      let same = 0, minSize = Math.min(childA.text.length, childB.text.length)
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++; posA--; posB--
      }
      return {a: posA, b: posB}
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1)
      if (inner) return inner
    }
    posA -= childA.size; posB -= childB.size
  }
}

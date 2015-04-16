import {Pos, Node, inline, slice} from "../model"

import {Step} from "./transform"
import {del} from "./delete"

function samePathDepth(a, b) {
  for (let i = 0;; i++)
    if (i == a.path.length || i == b.path.length || a.path[i] != b.path[i])
      return i
}

class Frontier {
  constructor(doc, from, to) {
    this.doc = doc
    this.left = this.buildLeft(from)
    this.right = this.buildRight(from, to)
    let same = samePathDepth(from, to)
    this.bottom = new Pos(from.path.slice(0, same),
                          same == from.path.length ? from.offset : from.path[same] + 1)
  }

  buildLeft(pos) {
    let frontier = []
    for (let i = 0, node = this.doc;; i++) {
      let last = i == pos.path.length
      let n = last ? pos.offset : pos.path[i]
      frontier.push({node: node, pos: new Pos(pos.path.slice(0, i), n)})
      if (last) return frontier
      node = node.content[n]
    }
  }

  buildRight(from, to) {
    // FIXME
  }
}

function nodesLeft(doc, depth) {
  let nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[0]
  }
}

function matchInsertedContent(frontier, open, same) {
  let matches = [], searchLeft = frontier.left.length - 1, searchRight = open.length - 1
  if (open[searchRight].type.block &&
      frontier.left[searchLeft].node.type.block) {
    matches.push({source: searchRight, target: searchLeft})
    searchLeft--
    searchRight--
  }
  for (;;) {
    let type = open[searchRight].type, found = null
    let outside = searchRight <= same
    for (let i = searchLeft; i >= 0; i--) {
      let left = frontier.left[i].node
      if (outside ? left.type.contains == type.contains : left.node.type == type) {
        found = i
        break
      }
    }
    if (found != null) {
      matches.push({source: searchRight, target: found})
      searchLeft = found - 1
      if (outside) break
    }
    searchRight--
  }
  return matches
}

function pushAll(target, elts) {
  for (let i = 0; i < elts.length; i++) target.push(elts[i])
}

function addInsertedContent(frontier, steps, source, start, end) {
  let remainder = slice.between(source, start, end)
  let nodes = nodesLeft(remainder, start.path.length)
  let sameInner = samePathDepth(start, end)
  let matches = matchInsertedContent(frontier, nodes, sameInner)

  let deletedTo = start.path.length
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i]
    let target = frontier.left[match.target], node = nodes[match.source]
    if (match.target < frontier.bottom.length) {
      pushAll(steps, split(target.pos, frontier.bottom.length - match.target))
      frontier.bottom = frontier.bottom.shorten(match.target, 1)
    }

    for (; deletedTo > match.source; deletedTo--)
      if (nodes[deletedTo].content.length == 0) nodes[deletedTo - 1].content.shift()
    if (node.content.length)
      steps.push(new Step("insert", target.pos, null, node.content))
    if (match.source) nodes[match.source - 1].content.shift()
    deletedTo = match.source - 1
    if (match.target == frontier.bottom.length)
      frontier.bottom = frontier.bottom.shift(node.maxOffset)
  }
}

export function replace(doc, from, to, source = null, start = null, end = null) {
  let steps = del(doc, from, to)
  let frontier = new Frontier(doc, from, to)
  if (source && start.cmp(end) < 0) {
    addInsertedContent(frontier, steps, source, start, end)
  }
  return steps
}


/* 
Concept of a 'cut' in the document -- the nodes that were involved in
deletion, on both sides, along with their new positions.

Tracking positions after the cut is probably easiest by using relative
offsets. The gap ends somewhere, and we simply have a number of level
associated with node, offset pairs. Confusingly, levels above are also
in the document, and the offset has to point either after those, or
before them. Before is probably better, but note that the current
document might have more content in them.

Inserting a source document is probably the hard part.

Completely decouple the code from that which handles glueing the
remaining part. They are essentially different.

 - Sections that can be glued onto the open part are inserts.

 - Do we allow it to grow the cut? (Escaping beyond the common
   ancestor.)

   - Must at least be able to escape from inline parent, or we can't
     insert any blocks

   - Also want to be able to join interesting node (lists, quotes) to
     equivalent parents at the insert context, so that you can use
     copy/paste to move strings of list items around.

   - So yes, but maybe only in limited circumstances.

 - Need a clean, understandable algorithm for finding places

   - If inline on both sides, inline block is merged

   - Next, look for interesting nodes that match, from inside to
     outside. ('interesting' flag on nodes?)

   - Finally, find a place for the leftover nodes. Nearest block
     context above lowest matched node.

Implement piecemeal:

 - Remove only
 - Add inline junk
 - Add leftover
 - Match interesting
 - Add inline after to
 - Stitch after to

Frontier data structure can be used to do the inserting.

When inserting below the cut (due to matches), do we split or simply
insert, leaving the original structure intact? Nodes above the
inserted content must definitely be split, to preserve ordering. This
moves the root of the cut, but does not change the node stack there.
Should such split nodes still be rejoined?

A(B(p("a") || p("b"))) + A(p("c")) = A(B(p("a")), p("c"), B(p("b")))

So, if content is inserted in between, joining is out. But if that
content ends in (open) nodes of a matching type, *that* should be
joined. So do update the frontier from the last inserted chunk. The
open depth there is slightly tricky, since it depends on how much of
the end path lies in that chunk (has not been put into another chunk).
This can be computed by taking the sameDepth of the two paths, and
decreasing the open depth when chunks whithin that sameDepth are
moved.

When matching pieces, ignore empty elements (everything below
sameDepth).

Then we have a root, a left frontier, and a right frontier stack.
Start from bottom, and join matching pieces. Except if top pieces
don't match automatically, and are both inline. In that case, first
split off the inline stuff at the right, ancestor it to the same level
as the one of the left, and recursively join. This is needed to keep
pos identities. Result should be insignificant for everything except
the inner stuff, so joining can go ahead without further complication.

Scan from top of right stack (minus potentially joined inline content)
for empty nodes (allows content, has none, not counting empty cut
nodes above). Delete outer empty node, if present.

*/

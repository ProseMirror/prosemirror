import {Transform, Remapping} from "../transform"

// ProseMirror's history implements not a way to roll back to a
// previous state, because ProseMirror supports applying changes
// without adding them to the history (for example during
// collaboration).
//
// To this end, each 'Branch' (one for the undo history and one for
// the redo history) keeps an array of 'Items', which can optionally
// hold a step (an actual undoable change), and always hold a position
// map (which is needed to move changes below them to apply to the
// current document).
//
// An item that has both a step and a selection token field is the
// start of an 'event' -- a group of changes that will be undone or
// redone at once. (It stores only a token, since that way we don't
// have to provide a document until the selection is actually applied,
// which is useful when compressing.)

// Used to schedule history compression
const max_empty_items = 500

class Branch {
  constructor(maxEvents) {
    this.events = 0
    this.maxEvents = maxEvents
    // Item 0 is always a dummy that's only used to have an id to
    // refer to at the start of the history.
    this.items = [new Item]
  }

  // : (Node, bool, ?Item) → ?{transform: Transform, selection: SelectionToken, ids: [number]}
  // Pop the latest event off the branch's history and apply it
  // to a document transform, returning the transform and the step IDs.
  popEvent(doc, preserveItems, upto) {
    let preserve = preserveItems, transform = new Transform(doc)
    let remap = new BranchRemapping
    let selection, ids = [], i = this.items.length

    for (;;) {
      let cur = this.items[--i]
      if (upto && cur == upto) break
      if (!cur.map) return null

      if (!cur.step) {
        remap.add(cur)
        preserve = true
        continue
      }

      if (preserve) {
        let step = cur.step.map(remap.remap), map

        this.items[i] = new MapItem(cur.map)
        if (step && transform.maybeStep(step).doc) {
          map = transform.maps[transform.maps.length - 1]
          this.items.push(new MapItem(map, this.items[i].id))
        }
        remap.movePastStep(cur, map)
      } else {
        this.items.pop()
        transform.maybeStep(cur.step)
      }

      ids.push(cur.id)
      if (cur.selection) {
        this.events--
        if (!upto) {
          selection = cur.selection.type.mapToken(cur.selection, remap.remap)
          break
        }
      }
    }

    return {transform, selection, ids}
  }

  clear() {
    this.items.length = 1
    this.events = 0
  }

  // : (Transform, ?[number]) → Branch
  // Create a new branch with the given transform added.
  addTransform(transform, selection, ids) {
    for (let i = 0; i < transform.steps.length; i++) {
      let step = transform.steps[i].invert(transform.docs[i])
      this.items.push(new StepItem(transform.maps[i], ids && ids[i], step, selection))
      if (selection) {
        this.events++
        selection = null
      }
    }
    if (this.events > this.maxEvents) this.clip()
  }

  // Clip this branch to the max number of events.
  clip() {
    var seen = 0, toClip = this.events - this.maxEvents
    for (let i = 0;; i++) {
      let cur = this.items[i]
      if (cur.selection) {
        if (seen < toClip) {
          ++seen
        } else {
          this.items.splice(0, i, new Item(null, this.events[toClip - 1]))
          this.events = this.maxEvents
          return
        }
      }
    }
  }

  addMaps(array) {
    if (this.events == 0) return
    for (let i = 0; i < array.length; i++)
      this.items.push(new MapItem(array[i]))
  }

  get changeID() {
    for (let i = this.items.length - 1; i > 0; i--)
      if (this.items[i].step) return this.items[i].id
    return this.items[0].id
  }

  findChangeID(id) {
    if (id == this.items[0].id) return this.items[0]

    for (let i = this.items.length - 1; i >= 0; i--) {
      let cur = this.items[i]
      if (cur.step) {
        if (cur.id == id) return cur
        if (cur.id < id) return null
      }
    }
  }

  // : ([PosMap], Transform, [number])
  // When the collab module receives remote changes, the history has
  // to know about those, so that it can adjust the steps that were
  // rebased on top of the remote changes, and include the position
  // maps for the remote changes in its array of items.
  rebased(newMaps, rebasedTransform, positions) {
    if (this.events == 0) return

    let rebasedItems = [], start = this.items.length - positions.length, startPos = 0
    if (start < 1) {
      startPos = 1 - start
      start = 1
      this.items[0] = new Item
    }

    if (positions.length) {
      let remap = new Remapping([], newMaps.slice())
      for (let iItem = start, iPosition = startPos; iItem < this.items.length; iItem++) {
        let item = this.items[iItem], pos = positions[iPosition++], id
        if (pos != -1) {
          let map = rebasedTransform.maps[pos]
          if (item.step) {
            let step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos])
            let selection = item.selection && item.selection.type.mapToken(item.selection, remap)
            rebasedItems.push(new StepItem(map, item.id, step, selection))
          } else {
            rebasedItems.push(new MapItem(map))
          }
          id = remap.addToBack(map)
        }
        remap.addToFront(item.map.invert(), id)
      }

      this.items.length = start
    }

    for (let i = 0; i < newMaps.length; i++)
      this.items.push(new MapItem(newMaps[i]))
    for (let i = 0; i < rebasedItems.length; i++)
      this.items.push(rebasedItems[i])

    if (!this.compressing && this.emptyItems(start) + newMaps.length > max_empty_items)
      this.compress(start + newMaps.length)
  }

  emptyItems(upto) {
    let count = 0
    for (let i = 1; i < upto; i++) if (!this.items[i].step) count++
    return count
  }

  // Compressing a branch means rewriting it to push the air (map-only
  // items) out. During collaboration, these naturally accumulate
  // because each remote change adds one. The `upto` argument is used
  // to ensure that only the items below a given level are compressed,
  // because `rebased` relies on a clean, untouched set of items in
  // order to associate old ids to rebased steps.
  compress(upto) {
    let remap = new BranchRemapping
    let items = [], events = 0
    for (let i = this.items.length - 1; i >= 0; i--) {
      let item = this.items[i]
      if (i >= upto) {
        items.push(item)
      } else if (item.step) {
        let step = item.step.map(remap.remap), map = step && step.posMap()
        remap.movePastStep(item, map)
        if (step) {
          let selection = item.selection && item.selection.type.mapToken(item.selection, remap.remap)
          items.push(new StepItem(map.invert(), item.id, step, selection))
          if (selection) events++
        }
      } else if (item.map) {
        remap.add(item)
      } else {
        items.push(item)
      }
    }
    this.items = items.reverse()
    this.events = events
  }

  toString() {
    return this.items.join("\n")
  }
}

// History items all have ids, but the meaning of these is somewhat
// complicated.
//
// - For StepItems, the ids are kept ordered (inside a given branch),
//   and are kept associated with a given change (if you undo and then
//   redo it, the resulting item gets the old id)
//
// - For MapItems, the ids are just opaque identifiers, not
//   necessarily ordered.
//
// - The placeholder item at the base of a branch's list
let nextID = 1

class Item {
  constructor(map, id) {
    this.map = map
    this.id = id || nextID++
  }

  toString() {
    return this.id + ":" + (this.map || "") + (this.step ? ":" + this.step : "") +
      (this.mirror != null ? "->" + this.mirror : "")
  }
}

class StepItem extends Item {
  constructor(map, id, step, selection) {
    super(map, id)
    this.step = step
    this.selection = selection
  }
}

class MapItem extends Item {
  constructor(map, mirror) {
    super(map)
    this.mirror = mirror
  }
}

// Assists with remapping a step with other changes that have been
// made since the step was first applied.
class BranchRemapping {
  constructor() {
    this.remap = new Remapping
    this.mirrorBuffer = Object.create(null)
  }

  add(item) {
    let id = this.remap.addToFront(item.map, this.mirrorBuffer[item.id])
    if (item.mirror != null) this.mirrorBuffer[item.mirror] = id
    return id
  }

  movePastStep(item, map) {
    let id = this.add(item)
    if (map) this.remap.addToBack(map, id)
  }
}

// ;; An undo/redo history manager for an editor instance.
export class History {
  constructor(pm) {
    this.pm = pm

    this.done = new Branch(pm.options.historyDepth)
    this.undone = new Branch(pm.options.historyDepth)

    this.lastAddedAt = 0
    this.ignoreTransform = false
    this.preserveItems = 0

    pm.on("transform", this.recordTransform.bind(this))
  }

  // : (Transform, Selection, Object)
  // Record a transformation in undo history.
  recordTransform(transform, selection, options) {
    if (this.ignoreTransform) return

    if (options.addToHistory == false) {
      this.done.addMaps(transform.maps)
      this.undone.addMaps(transform.maps)
    } else {
      let now = Date.now()
      // Group transforms that occur in quick succession into one event.
      let newGroup = now > this.lastAddedAt + this.pm.options.historyEventDelay
      this.done.addTransform(transform, newGroup ? selection.token : null)
      this.undone.clear()
      this.lastAddedAt = now
    }
  }

  // :: () → bool
  // Undo one history event. The return value indicates whether
  // anything was actually undone. Note that in a collaborative
  // context, or when changes are [applied](#ProseMirror.apply)
  // without adding them to the history, it is possible for
  // [`undoDepth`](#History.undoDepth) to have a positive value, but
  // this method to still return `false`, when non-history changes
  // overwrote all remaining changes in the history.
  undo() { return this.shift(this.done, this.undone) }

  // :: () → bool
  // Redo one history event. The return value indicates whether
  // anything was actually redone.
  redo() { return this.shift(this.undone, this.done) }

  // :: number
  // The amount of undoable events available.
  get undoDepth() { return this.done.events }

  // :: number
  // The amount of redoable events available.
  get redoDepth() { return this.undone.events }

  // : (Branch, Branch) → bool
  // Apply the latest event from one branch to the document and optionally
  // shift the event onto the other branch. Returns true when an event could
  // be shifted.
  shift(from, to) {
    let pop = from.popEvent(this.pm.doc, this.preserveItems > 0)
    if (!pop) return false
    let selectionBeforeTransform = this.pm.selection

    if (!pop.transform.steps.length) return this.shift(from, to)

    let selection = pop.selection.type.fromToken(pop.selection, pop.transform.doc)
    this.applyIgnoring(pop.transform, {selection})

    // Store the selection before transform on the event so that
    // it can be reapplied if the event is undone or redone (e.g.
    // redoing a character addition should place the cursor after
    // the character).
    to.addTransform(pop.transform, selectionBeforeTransform.token, pop.ids)

    this.lastAddedAt = 0

    return true
  }

  applyIgnoring(transform, options) {
    this.ignoreTransform = true
    this.pm.apply(transform, options)
    this.ignoreTransform = false
  }

  // :: () → Object
  // Get the current ‘version’ of the editor content. This can be used
  // to later [check](#History.isAtVersion) whether anything changed, or
  // to [roll back](#History.backToVersion) to this version.
  getVersion() {
    return this.done.changeID
  }

  // :: (Object) → bool
  // Returns `true` when the editor history is in the state that it
  // was when the given [version](#History.getVersion) was recorded.
  // That means either no changes were made, or changes were
  // done/undone and then undone/redone again.
  isAtVersion(version) {
    return this.done.changeID == version
  }

  // :: (Object) → bool
  // Rolls back all changes made since the given
  // [version](#History.getVersion) was recorded. Returns `false` if
  // that version was no longer found in the history, and thus the
  // action could not be completed.
  backToVersion(version) {
    let found = this.done.findChangeID(version)
    if (!found) return false
    let {transform} = this.done.popEvent(this.pm.doc, this.preserveItems > 0, found)
    this.applyIgnoring(transform)
    this.undone.clear()
    return true
  }

  // Used by the collab module to tell the history that some of its
  // content has been rebased.
  rebased(newMaps, rebasedTransform, positions) {
    this.done.rebased(newMaps, rebasedTransform, positions)
    this.undone.rebased(newMaps, rebasedTransform, positions)
  }
}

class Event {
  constructor(doc, sel) { this.doc = doc; this.sel = sel }
}

export default class History {
  constructor(pm) {
    this.pm = pm
    this.done = []
    this.undone = []
    this.lastAddedAt = 0
  }

  mark() {
    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push(new Event(this.pm.doc, this.pm.selection))
      this.undone.length = 0
      while (this.done.length > this.pm.options.historyDepth)
        this.done.shift()
    }
    this.lastAddedAt = now
  }

  undo() { move(this, this.done, this.undone) }
  redo() { move(this, this.undone, this.done) }
}

function move(hist, from, to) {
  var event = from.pop();
  if (event) {
    to.push(new Event(hist.pm.doc, hist.pm.selection))
    hist.pm.updateInner(event.doc, event.sel.anchor, event.sel.head)
    hist.lastAddedAt = 0
  }
}

const MIN_FLUSH_DELAY = 200
const UPDATE_TIMEOUT = 200

// ;; Helper for scheduling updates whenever the state of the editor
// changes, in such a way that the amount of [layout
// reflows](http://eloquentjavascript.net/13_dom.html#p_nnTb9RktUT) is
// minimized, by syncronizing the updates with editor [flush
// events](#ProseMirror.flush).
export class UpdateScheduler {
  // :: (ProseMirror, string, () -> ())
  // Creates an update scheduler for the given editor. `events` should
  // be a space-separated list of event names (for example
  // `"selectionChange change"`). Prepare should be a function that
  // _prepares_ an update. It should do any DOM measuring needed for
  // the update, and if DOM updates are needed, _return_ a function
  // that performs them. That way, if there are multiple components
  // that need to update, they can all do their measuring first, and
  // then, without triggering additional measuring, update the DOM.
  constructor(pm, events, prepare) {
    this.pm = pm
    this.prepare = prepare

    this.mustUpdate = false
    this.updateInfo = null
    this.timeout = null
    this.lastFlush = 0

    this.events = events.split(" ")
    this.onEvent = this.onEvent.bind(this)
    this.force = this.force.bind(this)
    this.events.forEach(event => pm.on(event, this.onEvent))
    pm.on("flush", this.onFlush = this.onFlush.bind(this))
    pm.on("flushed", this.onFlushed = this.onFlushed.bind(this))
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.
  detach() {
    clearTimeout(this.timeout)
    this.events.forEach(event => this.pm.off(event, this.onEvent))
    this.pm.off("flush", this.onFlush)
    this.pm.off("flushed", this.onFlushed)
  }

  onFlush() {
    let now = Date.now()
    if (this.mustUpdate && (now - this.lastFlush) >= MIN_FLUSH_DELAY) {
      this.lastFlush = now
      clearTimeout(this.timeout)
      this.mustUpdate = false
      this.update = this.prepare()
    }
  }

  onFlushed() {
    if (this.update) {
      this.update()
      this.update = null
    }
  }

  onEvent() {
    this.mustUpdate = true
    clearTimeout(this.timeout)
    this.timeout = setTimeout(this.force, UPDATE_TIMEOUT)
  }

  // :: ()
  // Force an update. Note that if the editor has scheduled a flush,
  // the update is still delayed until the flush occurs.
  force() {
    if (this.pm.operation) {
      this.onEvent()
    } else {
      this.mustUpdate = false
      this.updateInfo = null
      this.lastFlush = Date.now()
      clearTimeout(this.timeout)
      let update = this.prepare()
      if (update) update()
    }
  }
}

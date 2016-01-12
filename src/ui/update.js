const UPDATE_TIMEOUT = 200
const MIN_FLUSH_DELAY = 200

class CentralScheduler {
  constructor(pm) {
    this.waiting = []
    this.timeout = null
    this.lastForce = 0
    this.pm = pm
    this.force = this.force.bind(this)
    pm.on("flush", this.onFlush.bind(this))
  }

  set(f) {
    if (this.waiting.length == 0)
      this.timeout = setTimeout(this.force, UPDATE_TIMEOUT)
    if (this.waiting.indexOf(f) == -1) this.waiting.push(f)
  }

  unset(f) {
    let index = this.waiting.indexOf(f)
    if (index > -1) this.waiting.splice(index, 1)
  }

  force() {
    clearTimeout(this.timeout)
    this.lastForce = Date.now()

    while (this.waiting.length) {
      for (let i = 0; i < this.waiting.length; i++) {
        let result = this.waiting[i]()
        if (result) this.waiting[i] = result
        else this.waiting.splice(i--, 1)
      }
    }
  }

  onFlush() {
    if (this.waiting.length && (Date.now() - this.lastForce) > MIN_FLUSH_DELAY)
      this.force()
  }

  static get(pm) {
    return pm.mod.centralScheduler || (pm.mod.centralScheduler = new this(pm))
  }
}

// :: (ProseMirror, () -> ?() -> ?())
// Schedule a DOM update function to be called either the next time
// the editor is [flushed](#ProseMirror.flush), or if no flush happens
// immediately, after 200 milliseconds. This is used to synchronize
// DOM updates and read to prevent [DOM layout
// thrashing](http://eloquentjavascript.net/13_dom.html#p_nnTb9RktUT).
//
// Often, your updates will need to both read and write from the DOM.
// To schedule such access in lockstep with other modules, the
// function you give can return another function, which may return
// another function, and so on. The first call should _write_ to the
// DOM, and _not read_. If a _read_ needs to happen, that should be
// done in the function returned from the first call. If that has to
// be followed by another _write_, that should be done in a function
// returned from the second function, and so on.
export function scheduleDOMUpdate(pm, f) { CentralScheduler.get(pm).set(f) }

// :: (ProseMirror, () -> ?() -> ?())
// Cancel an update scheduled with `scheduleDOMUpdate`. Calling this with
// a function that is not actually scheduled is harmless.
export function unscheduleDOMUpdate(pm, f) { CentralScheduler.get(pm).unset(f) }

// ;; Helper for scheduling updates whenever any of a series of events
// happen.
export class UpdateScheduler {
  // :: (ProseMirror, string, () -> ?())
  // Creates an update scheduler for the given editor. `events` should
  // be a space-separated list of event names (for example
  // `"selectionChange change"`). `start` should be a function as
  // expected by `scheduleDOMUpdate`.
  constructor(pm, events, start) {
    this.pm = pm
    this.start = start

    this.events = events.split(" ")
    this.onEvent = this.onEvent.bind(this)
    this.events.forEach(event => pm.on(event, this.onEvent))
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.
  detach() {
    unscheduleDOMUpdate(this.pm, this.start)
    this.events.forEach(event => this.pm.off(event, this.onEvent))
  }

  onEvent() {
    scheduleDOMUpdate(this.pm, this.start)
  }

  // :: ()
  // Force an update. Note that if the editor has scheduled a flush,
  // the update is still delayed until the flush occurs.
  force() {
    if (this.pm.operation) {
      this.onEvent()
    } else {
      unscheduleDOMUpdate(this.pm, this.start)
      for (let run = this.start; run; run = run()) {}
    }
  }
}

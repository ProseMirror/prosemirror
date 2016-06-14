const UPDATE_TIMEOUT = 50
const MIN_FLUSH_DELAY = 100

class EditorScheduler {
  constructor(pm) {
    this.waiting = []
    this.timeout = null
    this.lastForce = 0
    this.pm = pm
    this.timedOut = () => {
      if (this.pm.operation)
        this.timeout = setTimeout(this.timedOut, UPDATE_TIMEOUT)
      else
        this.force()
    }
    pm.on.flush.add(this.onFlush.bind(this))
  }

  set(f) {
    if (this.waiting.length == 0)
      this.timeout = setTimeout(this.timedOut, UPDATE_TIMEOUT)
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
}
exports.EditorScheduler = EditorScheduler

// ;; Helper for scheduling updates whenever any of a series of events
// happen. Created with the
// [`updateScheduler`](#ProseMirror.updateScheduler) method.
class UpdateScheduler {
  constructor(pm, subscriptions, start) {
    this.pm = pm
    this.start = start

    this.subscriptions = subscriptions
    this.onEvent = this.onEvent.bind(this)
    this.subscriptions.forEach(sub => sub.add(this.onEvent))
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.
  detach() {
    this.pm.unscheduleDOMUpdate(this.start)
    this.subscriptions.forEach(sub => sub.remove(this.onEvent))
  }

  onEvent() {
    this.pm.scheduleDOMUpdate(this.start)
  }

  // :: ()
  // Force an update. Note that if the editor has scheduled a flush,
  // the update is still delayed until the flush occurs.
  force() {
    if (this.pm.operation) {
      this.onEvent()
    } else {
      this.pm.unscheduleDOMUpdate(this.start)
      for (let run = this.start; run; run = run()) {}
    }
  }
}
exports.UpdateScheduler = UpdateScheduler

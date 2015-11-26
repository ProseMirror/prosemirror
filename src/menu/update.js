const MIN_FLUSH_DELAY = 200
const UPDATE_TIMEOUT = 200

export class MenuUpdate {
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

  force() {
    this.mustUpdate = false
    this.updateInfo = null
    this.lastFlush = Date.now()
    clearTimeout(this.timeout)
    let update = this.prepare()
    if (update) update()
  }
}

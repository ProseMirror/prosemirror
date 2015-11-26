export class MenuUpdate {
  constructor(pm, events, prepare) {
    this.pm = pm
    this.prepare = prepare

    this.mustUpdate = false
    this.updateInfo = null

    this.events = events.split(" ")
    this.onEvent = () => this.mustUpdate = true
    this.events.forEach(event => pm.on(event, this.onEvent))
    pm.on("flush", this.onFlush = this.onFlush.bind(this))
    pm.on("flushed", this.onFlushed = this.onFlushed.bind(this))
  }

  detach() {
    this.events.forEach(event => this.pm.off(event, this.onEvent))
    this.pm.off("flush", this.onFlush)
    this.pm.off("flushed", this.onFlushed)
  }

  onFlush() {
    if (this.mustUpdate) {
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

  force() {
    this.mustUpdate = false
    this.updateInfo = null
    let update = this.prepare()
    if (update) update()
  }
}

export class Debounced {
  constructor(pm, delay, f) {
    this.pm = pm
    this.delay = delay
    this.scheduled = null
    this.f = f
    this.pending = null
  }

  trigger() {
    window.clearTimeout(this.scheduled)
    this.scheduled = window.setTimeout(() => this.fire(), this.delay)
  }

  fire() {
    if (!this.pending) {
      if (this.pm.operation)
        this.pm.on("flush", this.pending = () => {
          this.pm.off("flush", this.pending)
          this.pending = null
          this.f()
        })
      else
        this.f()
    }
  }

  clear() {
    window.clearTimeout(this.scheduled)
  }
}

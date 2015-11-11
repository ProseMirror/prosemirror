export const Map = window.Map || class {
  constructor() { this.content = [] }
  set(key, value) {
    let found = this.find(key)
    if (found > -1) this.content[found + 1] = value
    else this.content.push(key, value)
  }
  get(key) {
    let found = this.find(key)
    return found == -1 ? undefined : this.content[found + 1]
  }
  has(key) {
    return this.find(key) > -1
  }
  find(key) {
    for (let i = 0; i < this.content.length; i += 2)
      if (this.content[i] === key) return i
  }
  get size() {
    return this.content.length / 2
  }
  clear() {
    this.content.length = 0
  }
}

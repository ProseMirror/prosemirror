export class OrderedMap {
  constructor(content) {
    this.content = content
  }

  find(key) {
    for (let i = 0; i < this.content.length; i += 2)
      if (this.content[i] == key) return i
    return -1
  }

  addToStart(map) {
    map = OrderedMap.from(map)
    return new OrderedMap(map.content.concat(this.subtract(map).content))
  }

  addToEnd(map) {
    map = OrderedMap.from(map)
    return new OrderedMap(this.subtract(map).content.concat(map.content))
  }

  set(key, value, newKey) {
    let found = this.find(key), content = this.content.slice()
    if (found == -1) {
      content.push(newKey || key, value)
    } else {
      content[found + 1] = value
      if (newKey) content[found] = newKey
    }
    return new OrderedMap(content)
  }

  remove(key) {
    let found = this.find(key)
    if (found == -1) return this
    let content = this.content.slice()
    content.splice(found, 2)
    return new OrderedMap(content)
  }

  subtract(map) {
    let result = this
    OrderedMap.from(map).forEach(key => result = result.remove(key))
    return result
  }

  forEach(f) {
    for (let i = 0; i < this.content.length; i += 2)
      f(this.content[i], this.content[i + 1])
  }

  get(key) {
    let found = this.find(key)
    return found == -1 ? undefined : this.content[found + 1]
  }

  setAtStart(key, value) {
    return new OrderedMap([key, value].concat(this.remove(key).content))
  }

  setAtEnd(key, value) {
    let content = this.remove(key).content.slice()
    content.push(key, value)
    return new OrderedMap(content)
  }

  get size() {
    return this.content.length >> 1
  }

  static from(value) {
    if (value instanceof OrderedMap) return value
    let content = []
    if (value) for (let prop in value) content.push(prop, value[prop])
    return new OrderedMap(content)
  }
}

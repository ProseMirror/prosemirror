const methods = {
  on(type, f) {
    let map = this._handlers || (this._handlers = {})
    let arr = map[type] || (map[type] = [])
    arr.push(f)
  },

  off(type, f) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i)
      if (arr[i] == f) { arr.splice(i, 1); break }
  },

  signal(type, ...values) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i)
      arr[i](...values)
  },

  signalHandleable(type, ...values) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i) {
      let result = arr[i](...values)
      if (result !== false) return result
    }
    return false
  },

  hasHandler(type) {
    let arr = this._handlers && this._handlers[type]
    return arr && arr.length > 0
  }
}

// Add event-related methods to a constructor's prototype, to make
// registering events on such objects more convenient.
export function eventMixin(ctor) {
  let proto = ctor.prototype
  for (var prop in methods) if (methods.hasOwnProperty(prop))
    proto[prop] = methods[prop]
}

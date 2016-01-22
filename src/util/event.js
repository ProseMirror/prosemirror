// ;; #path=EventMixin #kind=interface
// A set of methods for objects that emit events. Added by calling
// `eventMixin` on a constructor.

const methods = {
  // :: (type: string, handler: (...args: [any])) #path=EventMixin.on
  // Register an event handler for the given event type.
  on(type, f) {
    let map = this._handlers || (this._handlers = {})
    let arr = map[type] || (map[type] = [])
    arr.push(f)
  },

  // :: (type: string, handler: (...args: [any])) #path=EventMixin.off
  // Unregister an event handler for the given event type.
  off(type, f) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i)
      if (arr[i] == f) { arr.splice(i, 1); break }
  },

  // :: (type: string, ...args: [any]) #path=EventMixin.signal
  // Signal an event of the given type, passing any number of
  // arguments. Will call the handlers for the event, passing them the
  // arguments.
  signal(type, ...values) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i)
      arr[i](...values)
  },

  // :: (type: string, ...args: [any]) #path=EventMixin.signalHandleable
  // Signal a handleable event of the given type. All handlers for the
  // event will be called with the given arguments, until one of them
  // returns something that is not the value `false`. When that
  // happens, the return value of that handler is returned. If that
  // does not happen, `false` is returned.
  signalHandleable(type, ...values) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i) {
      let result = arr[i](...values)
      if (result !== false) return result
    }
    return false
  },

  // :: (type: string, value: any)
  // Give all handlers for an event a chance to transform a value. The
  // value returned from a handler will be passed to the next handler.
  // The method returns the value returned by the final handler (or
  // the original value, if there are no handlers).
  signalPipelined(type, value) {
    let arr = this._handlers && this._handlers[type]
    if (arr) for (let i = 0; i < arr.length; ++i)
      value = arr[i](value)
    return value
  },

  // :: (type: string) → bool #path=EventMixin.hasHandler
  // Query whether there are any handlers for this event type.
  hasHandler(type) {
    let arr = this._handlers && this._handlers[type]
    return arr && arr.length > 0
  }
}

// :: (())
// Add the methods in the `EventMixin` interface to the prototype
// object of the given constructor.
export function eventMixin(ctor) {
  let proto = ctor.prototype
  for (var prop in methods) if (methods.hasOwnProperty(prop))
    proto[prop] = methods[prop]
}

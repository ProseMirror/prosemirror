export function addEventListener(emitter, type, f) {
  let map = emitter._handlers || (emitter._handlers = {})
  let arr = map[type] || (map[type] = [])
  arr.push(f)
}

export function removeEventListener(emitter, type, f) {
  let arr = emitter._handlers && emitter._handlers[type]
  if (arr) for (let i = 0; i < arr.length; ++i)
    if (arr[i] == f) { arr.splice(i, 1); break }
}

export function signal(emitter, type, ...values) {
  let arr = emitter._handlers && emitter._handlers[type]
  if (arr) for (let i = 0; i < arr.length; ++i)
    arr[i](...values)
}

export function hasHandler(emitter, type) {
  let arr = emitter._handlers && emitter._handlers[type]
  return arr && arr.length > 0
}

// Add event-related methods to a constructor's prototype, to make
// registering events on such objects more convenient.
export function eventMixin(ctor) {
  let proto = ctor.prototype
  proto.on = proto.addEventListener = function(type, f) { addEventListener(this, type, f) }
  proto.off = proto.removeEventListener = function(type, f) { removeEventListener(this, type, f) }
  proto.signal = function(type, ...values) { signal(this, type, ...values) }
}

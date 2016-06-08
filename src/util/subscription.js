class Handler {
  constructor(f, once, priority) {
    this.f = f
    this.once = once
    this.priority = priority
  }
}

// ;; A subscription is an object that you can add subscribers
// (functions) to, which will be called every time the subscription is
// dispatched.
const Subscription = exports.Subscription = class {
  // :: ()
  constructor() {
    this.handlers = []
  }

  insert(handler) {
    let pos = 0
    for (; pos < this.handlers.length; pos++)
      if (this.handlers[pos].priority < handler.priority) break
    this.handlers = this.handlers.slice(0, pos).concat(handler).concat(this.handlers.slice(pos))
  }

  handlersForDispatch() {
    let handlers = this.handlers, updated = null
    for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i].once) {
      if (!updated) updated = handlers.slice()
      updated.splice(i, 1)
    }
    if (updated) this.handlers = updated
    return handlers
  }

  // :: (Function, ?number)
  // Add a function of the appropriate type for this subscription to
  // be called whenever the subscription is dispatched. When
  // `priority` is provided, it determines when the function is called
  // relative to other handlers.
  add(f, priority = 0) {
    this.insert(new Handler(f, false, priority))
  }

  // :: (Function, ?number)
  // Add a function to be called once, the next time this subscription
  // is dispatched.
  addOnce(f, priority = 0) {
    this.insert(new Handler(f, true, priority))
  }

  // :: (Function)
  // Remove the given function from the subscription.
  remove(f) {
    for (let i = 0; i < this.handlers.length; i++) if (this.handlers[i].f == f) {
      this.handlers = this.handlers.slice(0, i).concat(this.handlers.slice(i + 1))
      return
    }
  }

  // :: () → bool
  // Returns true if there are any functions registered with this
  // subscription.
  hasHandler() {
    return this.handlers.length > 0
  }

  // :: (...any)
  // Call all handlers for this subscription with the given arguments.
  dispatch(...args) {
    let handlers = this.handlersForDispatch()
    for (let i = 0; i < handlers.length; i++)
      handlers[i].f(...args)
  }
}

// ;; A pipelined subscription runs its handlers one a value one at a
// time, passing the return value from the previous handler to the
// next one.
exports.PipelineSubscription = class extends Subscription {
  // :: (any) → any
  // Run all handlers on the given value, returning the result.
  dispatch(value) {
    let handlers = this.handlersForDispatch()
    for (let i = 0; i < handlers.length; i++)
      value = handlers[i].f(value)
    return value
  }
}

// ;; A stoppable subscription is a subscription that stops calling
// handlers as soon as a handler returns a truthy value.
exports.StoppableSubscription = class extends Subscription {
  // :: (...any) → any
  // Call handlers with the given arguments. When one of them returns
  // a truthy value, immediately return that value.
  dispatch(...args) {
    let handlers = this.handlersForDispatch()
    for (let i = 0; i < handlers.length; i++) {
      let result = handlers[i].f(...args)
      if (result) return result
    }
  }
}

// ;; A DOM subscription can be used to allow intermediate handlers
// for DOM events. It will call handlers until one of them returns a
// truthy value or calls `preventDefault` on the DOM event.
exports.DOMSubscription = class extends Subscription {
  // :: (DOMEvent) → bool
  // Run handlers on the given DOM event until one of them returns a
  // truty value or prevents the event's default behavior. Returns
  // true if the event was handled.
  dispatch(event) {
    let handlers = this.handlersForDispatch()
    for (let i = 0; i < handlers.length; i++)
      if (handlers[i].f(event) || event.defaultPrevented) return true
    return false
  }
}

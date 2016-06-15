const pluginProps = Object.create(null)

// Each plugin gets assigned a unique property name, so that its state
// can be stored in the editor's `plugin` object.
function registerProp(name = "plugin") {
  for (let i = 1;; i++) {
    let prop = name + (i > 1 ? "_" + i : "")
    if (!(prop in pluginProps)) return pluginProps[prop] = prop
  }
}

// ;; A plugin is a piece of functionality that can be attached to a
// ProseMirror instance. It may do something like show a
// [menu](#menubar) or wire in [collaborative editing](#collab). The
// plugin object is the interface to enabling and disabling the
// plugin, and for those where this is relevant, for accessing its
// state.
class Plugin {
  // :: (constructor, ?Object)
  // Create a plugin object for the given state class. If desired, you
  // can pass a collection of options. When initializing the plugin,
  // it will receive the ProseMirror instance and the options as
  // arguments to its constructor.
  constructor(State, options, prop) {
    this.State = State
    this.options = options || Object.create(null)
    this.prop = prop || registerProp(State.name)
  }

  // :: (ProseMirror) → ?any
  // Return the plugin state for the given editor, if any.
  get(pm) { return pm.plugin[this.prop] }

  // :: (ProseMirror) → any
  // Initialize the plugin for the given editor. If it was already
  // enabled, this throws an error.
  attach(pm) {
    if (this.get(pm)) throw new RangeError("Attaching plugin multiple times")
    return pm.plugin[this.prop] = new this.State(pm, this.options)
  }

  // :: (ProseMirror)
  // Disable the plugin in the given editor. If the state has a
  // `detach` method, that will be called with the editor as argument,
  // to give it a chance to clean up.
  detach(pm) {
    let found = this.get(pm)
    if (found) {
      if (found.detach) found.detach(pm)
      delete pm.plugin[this.prop]
    }
  }

  // :: (ProseMirror) → any
  // Get the plugin state for an editor. Initializes the plugin if it
  // wasn't already active.
  ensure(pm) {
    return this.get(pm) || this.attach(pm)
  }

  // :: (?Object) → Plugin
  // Configure the plugin. The given options will be combined with the
  // existing (default) options, with the newly provided ones taking
  // precedence. Returns a new plugin object with the new
  // configuration.
  config(options) {
    if (!options) return this
    let result = Object.create(null)
    for (let prop in this.options) result[prop] = this.options[prop]
    for (let prop in options) result[prop] = options[prop]
    return new Plugin(this.State, result, this.prop)
  }
}
exports.Plugin = Plugin

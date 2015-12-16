// From CodeMirror, should be factored into its own NPM module

// declare_global: navigator
let mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false

// :: Object<string>
// A map from key codes to key names.
export const keyNames = {
  3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
  19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
  36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
  46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
  106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
  173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
  221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
  63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
}

// Number keys
for (let i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i)
// Alphabetic keys
for (let i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i)
// Function keys
for (let i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i

// :: (KeyboardEvent) → ?string
// Find a name for the given keydown event. If the keycode in the
// event is not known, this will return `null`. Otherwise, it will
// return a string like `"Shift-Cmd-Ctrl-Alt-Home"`. The parts before
// the dashes give the modifiers (always in that order, if present),
// and the last word gives the key name, which one of the names in
// `keyNames`.
//
// The convention for keypress events is to use the pressed character
// between single quotes. Due to limitations in the browser API,
// keypress events can not have modifiers.
export function keyName(event) {
  let base = keyNames[event.keyCode], name = base
  if (name == null || event.altGraphKey) return null

  if (event.altKey && base != "Alt") name = "Alt-" + name
  if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name
  if (event.metaKey && base != "Cmd") name = "Cmd-" + name
  if (event.shiftKey && base != "Shift") name = "Shift-" + name
  return name
}

// :: (string) → bool
// Test whether the given key name refers to a modifier key.
export function isModifierKey(name) {
  name = /[^-]*$/.exec(name)[0]
  return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
}

// :: (string) → string
// Normalize a sloppy key name, which may have modifiers in the wrong
// order or use shorthands for modifiers, to a properly formed key
// name. Used to normalize names provided in keymaps.
//
// Note that the modifier `mod` is a shorthand for `Cmd` on Mac, and
// `Ctrl` on other platforms.
export function normalizeKeyName(name) {
  let parts = name.split(/-(?!'?$)/), result = parts[parts.length - 1]
  let alt, ctrl, shift, cmd
  for (let i = 0; i < parts.length - 1; i++) {
    let mod = parts[i]
    if (/^(cmd|meta|m)$/i.test(mod)) cmd = true
    else if (/^a(lt)?$/i.test(mod)) alt = true
    else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true
    else if (/^s(hift)$/i.test(mod)) shift = true
    else if (/^mod$/i.test(mod)) { if (mac) cmd = true; else ctrl = true }
    else throw new Error("Unrecognized modifier name: " + mod)
  }
  if (alt) result = "Alt-" + result
  if (ctrl) result = "Ctrl-" + result
  if (cmd) result = "Cmd-" + result
  if (shift) result = "Shift-" + result
  return result
}

// ;; A keymap binds a set of [key names](#keyName) to commands names
// or functions.
export class Keymap {
  // :: (Object, ?Object)
  // Construct a keymap using the bindings in `keys`, whose properties
  // should be [key names](#keyName) or space-separated sequences of
  // key names. In the second case, the binding will be for a
  // multi-stroke key combination.
  //
  // When `options` has a property `call`, this will be a programmatic
  // keymap, meaning that instead of looking keys up in its set of
  // bindings, it will pass the key name to `options.call`, and use
  // the return value of that calls as the resolved binding.
  //
  // `options.name` can be used to give the keymap a name, making it
  // easier to [remove](#ProseMirror.removeKeymap) from an editor.
  constructor(keys, options) {
    this.options = options || {}
    this.bindings = Object.create(null)
    if (keys) for (let keyname in keys) if (Object.prototype.hasOwnProperty.call(keys, keyname))
      this.addBinding(keyname, keys[keyname])
  }

  // :: (string, any)
  // Add a binding for the given key or key sequence.
  addBinding(keyname, value) {
    let keys = keyname.split(/ +(?!\')/).map(normalizeKeyName)
    for (let i = 0; i < keys.length; i++) {
      let name = keys.slice(0, i + 1).join(" ")
      let val = i == keys.length - 1 ? value : "..."
      let prev = this.bindings[name]
      if (!prev) this.bindings[name] = val
      else if (prev != val) throw new Error("Inconsistent bindings for " + name)
    }
  }

  // :: (string)
  // Remove the binding for the given key or key sequence.
  removeBinding(keyname) {
    let keys = keyname.split(/ +(?!\')/).map(normalizeKeyName)
    for (let i = keys.length - 1; i >= 0; i--) {
      let name = keys.slice(0, i).join(" ")
      let val = this.bindings[name]
      if (val == "..." && !this.unusedMulti(name))
        break
      else if (val)
        delete this.bindings[name]
    }
  }

  unusedMulti(name) {
    for (let binding in this.bindings)
      if (binding.length > name && binding.indexOf(name) == 0 && binding.charAt(name.length) == " ")
        return false
    return true
  }

  // :: (string, ?any) → any
  // Looks up the given key or key sequence in this keymap. Returns
  // the value the key is bound to (which may be undefined if it is
  // not bound), or the string `"..."` if the key is a prefix of a
  // multi-key sequence that is bound by this keymap.
  lookup(key, context) {
    return this.options.call ? this.options.call(key, context) : this.bindings[key]
  }
}

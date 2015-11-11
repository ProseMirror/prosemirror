// From CodeMirror, should be factored into its own NPM module

// declare_global: navigator
let mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false

/**
 * A map of KeyboardEvent keycodes to key names.
 *
 * @type {Array}
 */
export const names = {
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
for (let i = 0; i < 10; i++) names[i + 48] = names[i + 96] = String(i)
// Alphabetic keys
for (let i = 65; i <= 90; i++) names[i] = String.fromCharCode(i)
// Function keys
for (let i = 1; i <= 12; i++) names[i + 111] = names[i + 63235] = "F" + i

/**
 * Given a keypress event, get the key name.
 *
 * @param  {KeyboardEvent} event   The keypress event.
 * @param  {Boolean}       noShift
 * @return {string}                The key name.
 */
export function keyName(event, noShift) {
  let base = names[event.keyCode], name = base
  if (name == null || event.altGraphKey) return false

  if (event.altKey && base != "Alt") name = "Alt-" + name
  if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name
  if (event.metaKey && base != "Cmd") name = "Cmd-" + name
  if (!noShift && event.shiftKey && base != "Shift") name = "Shift-" + name
  return name
}

export function isModifierKey(value) {
  let name = typeof value == "string" ? value : names[value.keyCode]
  return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
}

export function normalizeKeyName(fullName) {
  let parts = fullName.split(/-(?!'?$)/), name = parts[parts.length - 1]
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
  if (alt) name = "Alt-" + name
  if (ctrl) name = "Ctrl-" + name
  if (cmd) name = "Cmd-" + name
  if (shift) name = "Shift-" + name
  return name
}

/**
 * A group of bindings of key names and editor commands,
 * which override the default key press event behavior in the editor's DOM.
 */
export class Keymap {
  constructor(keys, options) {
    this.options = options || {}
    this.bindings = Object.create(null)
    if (keys) for (let keyname in keys) if (Object.prototype.hasOwnProperty.call(keys, keyname))
      this.addBinding(keyname, keys[keyname])
  }

  addBinding(keyname, value) {
    let keys = keyname.split(" ").map(normalizeKeyName)
    for (let i = 0; i < keys.length; i++) {
      let name = keys.slice(0, i + 1).join(" ")
      let val = i == keys.length - 1 ? value : "..."
      let prev = this.bindings[name]
      if (!prev) this.bindings[name] = val
      else if (prev != val) throw new Error("Inconsistent bindings for " + name)
    }
  }

  removeBinding(keyname) {
    let keys = keyname.split(" ").map(normalizeKeyName)
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
}

/**
 * Lookup a key name in a KeyMap, and pass the mapped value to a handler.
 *
 * @param {string}   key     The key name.
 * @param {Keymap}   map     The key map. If the keymap has an options.call method,
 *                           that will be invoked to get the mapped value.
 * @param {Function} handle  Callback
 * @param {Object}   context
 * @return {string} If the key name has a mapping and the callback is invoked ("handled"),
 *                  if the key name needs to be combined in sequence with the next key ("multi"),
 *                  if there is no mapping ("nothing").
 */
export function lookupKey(key, map, handle, context) {
  let found = map.options.call ? map.options.call(key, context) : map.bindings[key]
  if (found === false) return "nothing"
  if (found === "...") return "multi"
  if (found != null && handle(found)) return "handled"

  let fall = map.options.fallthrough
  if (fall) {
    if (!Array.isArray(fall))
      return lookupKey(key, fall, handle, context)
    for (let i = 0; i < fall.length; i++) {
      let result = lookupKey(key, fall[i], handle, context)
      if (result) return result
    }
  }
}

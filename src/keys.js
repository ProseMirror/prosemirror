// From CodeMirror, should be factored into its own NPM module

export const names = {
  3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
  19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
  36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
  46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod", 107: "=", 109: "-", 127: "Delete",
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

export function keyName(event, noShift) {
  let base = names[event.keyCode], name = base;
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

function normalizeKeyName(name) {
  let parts = name.split(/-(?!$)/), name = parts[parts.length - 1]
  let alt, ctrl, shift, cmd
  for (let i = 0; i < parts.length - 1; i++) {
    let mod = parts[i]
    if (/^(cmd|meta|m)$/i.test(mod)) cmd = true
    else if (/^a(lt)?$/i.test(mod)) alt = true
    else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true
    else if (/^s(hift)$/i.test(mod)) shift = true
    else throw new Error("Unrecognized modifier name: " + mod)
  }
  if (alt) name = "Alt-" + name
  if (ctrl) name = "Ctrl-" + name
  if (cmd) name = "Cmd-" + name
  if (shift) name = "Shift-" + name
  return name
}

export function normalizeKeymap(keymap) {
  let result = {};
  for (let keyname in keymap) if (keymap.hasOwnProperty(keyname)) {
    let value = keymap[keyname]
    if (value == "...") continue
    if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) {
      result[keyname] = value
      continue
    }

    let keys = keyname.split(" ").map(normalizeKeyName)
    for (let i = 0; i < keys.length; i++) {
      let val, name
      if (i == keys.length - 1) {
        name = keyname
        val = value
      } else {
        name = keys.slice(0, i + 1).join(" ")
        val = "..."
      }
      let prev = result[name]
      if (!prev) result[name] = val
      else if (prev != val)
        throw new Error("Inconsistent bindings for " + name)
    }
  }
  return result
}

export function lookupKey(key, map, handle, context) {
  let found = map.call ? map.call(null, key, context) : map[key]
  if (found === false) return "nothing"
  if (found === "...") return "multi"
  if (found != null && handle(found)) return "handled"

  if (map.fallthrough) {
    if (Array.isArray(map.fallthrough))
      return lookupKey(key, map.fallthrough, handle, context)
    for (let i = 0; i < map.fallthrough.length; i++) {
      let result = lookupKey(key, map.fallthrough[i], handle, context)
      if (result) return result
    }
  }
}

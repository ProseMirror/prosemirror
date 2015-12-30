import {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongMark, EmMark, CodeMark, LinkMark, Image, Pos, NodeType, MarkType} from "../model"
import {joinPoint, joinableBlocks, canLift, canWrap} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"

import {charCategory, isExtendingChar} from "./char"
import {Keymap} from "./keys"
import {findSelectionFrom, verticalMotionLeavesTextblock, setDOMSelectionToPos, NodeSelection} from "./selection"

const commands = Object.create(null)

const paramHandlers = Object.create(null)

// :: (CommandSpec)
// Define a globally available command. Note that
// [namespaces](#namespace) can still be used to prevent the command
// from showing up in editor where you don't want it to show up.
export function defineCommand(spec) {
  if (commands[spec.name])
    throw new Error("Duplicate definition of command " + spec.name)
  commands[spec.name] = spec
}

// ;; A command is a named piece of functionality that can be bound to
// a key, shown in the menu, or otherwise exposed to the user.
//
// The commands available in a given editor are gathered from the
// commands defined with `defineCommand`, and from
// [specs](#CommandSpec) associated with node and mark types in the
// editor's [schema](#Schema.registry). Use the
// [`register`](#NodeType.register) method with `"command"` as the
// name and a `CommandSpec` as value to associate a command with a
// node or mark.
//
// This module defines a [bunch of commands](#edit_commands) in the
// [default schema](#defaultSchema) and global command registry.
export class Command {
  constructor(spec, self, name) {
    // :: string The name of the command.
    this.name = name || spec.name
    if (!this.name) throw new Error("Trying to define a command without a name")
    // :: CommandSpec The command's specifying object.
    this.spec = spec
    this.self = self
  }

  // :: (ProseMirror, ?[any]) → ?bool
  // Execute this command. If the command takes
  // [parameters](#Command.params), they can be passed as second
  // argument here, or omitted, in which case a [parameter
  // handler](#defineParamHandler) will be called to prompt the user
  // for values.
  //
  // Returns the value returned by the command spec's [`run`
  // method](#CommandSpec.run), or `false` if the command could not be
  // ran.
  exec(pm, params) {
    let run = this.spec.run
    if (!this.params.length) return run.call(this.self, pm)
    if (params) return run.call(this.self, pm, ...params)
    let handler = getParamHandler(pm)
    if (!handler) return false
    handler(pm, this, params => {
      if (params) run.call(this.self, pm, ...params)
    })
  }

  // :: (ProseMirror) → bool
  // Ask this command whether it is currently relevant, given the
  // editor's document and selection. If the command does not define a
  // [`select`](#CommandSpec.select) method, this always returns true.
  select(pm) {
    let f = this.spec.select
    return f ? f.call(this.self, pm) : true
  }

  // :: (ProseMirror) → bool
  // Ask this command whether it is “active”. This is mostly used to
  // style inline mark icons (such as strong) differently when the
  // selection contains such marks.
  active(pm) {
    let f = this.spec.active
    return f ? f.call(this.self, pm) : false
  }

  // :: [CommandParam]
  // Get the list of parameters that this command expects.
  get params() {
    return this.spec.params || empty
  }

  // :: string
  // Get the label for this command.
  get label() {
    return this.spec.label || this.name
  }
}

const empty = []

// ;; #path=CommandSpec #kind=interface #toc=false
// Commands are defined using objects that specify various aspects of
// the command. The only properties that _must_ appear in a command
// spec are [`name`](#CommandSpec.name) and [`run`](#CommandSpec.run).
// You should probably also give your commands a `label`.

// :: string #path=CommandSpec.name
// The name of the command, which will be its key in
// `ProseMirror.commands`, and the thing passed to
// [`execCommand`](#ProseMirror.execCommand). Can be
// [namespaced](#namespaces), (and probably should, for user-defined
// commands).

// :: string #path=CommandSpec.label
// A user-facing label for the command. This will be used, among other
// things. as the tooltip title for the command's menu item. If there
// is no `label`, the command's `name` will be used instead.

// :: (pm: ProseMirror, ...params: [any]) → ?bool #path=CommandSpec.run
// The function that executes the command. If the command has
// [parameters](#CommandSpec.params), their values are passed as
// arguments. For commands [registered](#NodeType.register) on node or
// mark types, `this` will be bound to the node or mark type when this
// function is ran. Should return `false` when the command could not
// be executed.

// :: [CommandParam] #path=CommandSpec.params
// The parameters that this command expects.

// :: (pm: ProseMirror) → bool #path=CommandSpec.select
// The function used to [select](#Command.select) the command. `this`
// will again be bound to a node or mark type, when available.

// :: (pm: ProseMirror) → bool #path=CommandSpec.active
// The function used to determine whether the command is
// [active](#Command.active). `this` refers to the associated node or
// mark type.

// :: union<string, [string]> #path=CommandSpec.keys
// The default key bindings for this command. May either be an array
// of strings containing [key names](#FIXME), or an object with
// optional `all`, `mac`, and `pc` properties, specifying arrays of
// keys for different platforms.

// :: union<bool, object> #path=CommandSpec.derive
// [Mark](#MarkType) and [node](#NodeType) types often need to define
// boilerplate commands. To reduce the amount of duplicated code, you
// can derive such commands by setting the `derive` property to either
// `true` or an object which is passed to the deriving function. If
// this object has a `name` property, that is used, instead of the
// command name, to pick a deriving function.
//
// For node types, you can derive `"insert"`, `"make"`, and `"wrap"`.
//
// For mark types, you can derive `"set"`, `"unset"`, and `"toggle"`.

// FIXME document menu and icon properties

// ;; #path=CommandParam #kind=interface #toc=false
// The parameters that a command can take are specified using objects
// with the following properties:

// :: string #path=CommandParam.label
// The user-facing name of the parameter. Shown to the user when
// prompting for this parameter.

// :: string #path=CommandParam.type
// The type of the parameter. Supported types are `"text"` and `"select"`.

// :: any #path=CommandParam.default
// A default value for the parameter.

// :: (string, (pm: ProseMirror, cmd: Command, callback: (?[any])))
// Register a parameter handler, which is a function that prompts the
// user to enter values for a command's [parameters](#CommandParam), and
// calls a callback with the values received. See also the
// [`commandParamHandler` option](#commandParamHandler).
export function defineParamHandler(name, handler) {
  paramHandlers[name] = handler
}

function getParamHandler(pm) {
  let option = pm.options.commandParamHandler
  if (option && paramHandlers[option]) return paramHandlers[option]
}

export function deriveCommands(pm) {
  let found = Object.create(null), config = pm.options.commands
  function add(name, spec, self) {
    if (!pm.isInNamespace(name)) return
    if (found[name]) throw new Error("Duplicate definition of command " + name)
    found[name] = new Command(spec, self, name)
  }
  function addAndOverride(name, spec, self) {
    if (Object.prototype.hasOwnProperty.call(config, name)) {
      let confSpec = config[name]
      if (!confSpec) return
      if (confSpec.run) return
      let newSpec = Object.create(null)
      for (let prop in spec) newSpec[prop] = spec[prop]
      for (let prop in confSpec) newSpec[prop] = confSpec[prop]
      spec = newSpec
    }
    add(name, spec, self)
  }

  pm.schema.registry("command", (spec, type, name) => {
    if (spec.derive) {
      let conf = typeof spec.derive == "object" ? spec.derive : {}
      let dname = conf.name || spec.name
      let derive = type.constructor.deriveableCommands[dname]
      if (!derive) throw new Error("Don't know how to derive command " + dname)
      let derived = derive.call(type, conf)
      for (var prop in spec) if (prop != "derive") derived[prop] = spec[prop]
      spec = derived
    }
    addAndOverride("schema:" + name + ":" + spec.name, spec, type)
  })
  for (let name in commands)
    addAndOverride(name, commands[name])
  for (let name in config) {
    let spec = config[name]
    if (spec && spec.run) add(name, spec)
  }
  return found
}

export function deriveKeymap(pm) {
  let bindings = {}, platform = browser.mac ? "mac" : "pc"
  function add(command, keys) {
    for (let i = 0; i < keys.length; i++) {
      let [_, name, rank = 50] = /^(.+?)(?:\((\d+)\))?$/.exec(keys[i])
      sortedInsert(bindings[name] || (bindings[name] = []), {command, rank},
                   (a, b) => a.rank - b.rank)
    }
  }
  for (let name in pm.commands) {
    let cmd = pm.commands[name], keys = cmd.spec.keys
    if (!keys) continue
    if (Array.isArray(keys)) add(cmd, keys)
    if (keys.all) add(cmd, keys.all)
    if (keys[platform]) add(cmd, keys[platform])
  }

  for (let key in bindings)
    bindings[key] = bindings[key].map(b => b.command.name)
  return new Keymap(bindings)
}

const andScroll = {scrollIntoView: true}

function markActive(pm, type) {
  let sel = pm.selection
  if (sel.empty)
    return type.isInSet(pm.activeMarks())
  else
    return pm.doc.rangeHasMark(sel.from, sel.to, type)
}

function canAddInline(pm, type) {
  let {from, to, empty} = pm.selection
  if (empty)
    return !type.isInSet(pm.activeMarks()) && pm.doc.path(from.path).type.canContainMark(type)
  let can = false
  pm.doc.nodesBetween(from, to, node => {
    if (can || node.isTextblock && !node.type.canContainMark(type)) return false
    if (node.isInline && !type.isInSet(node.marks)) can = true
  })
  return can
}

function markApplies(pm, type) {
  let {from, to} = pm.selection
  let relevant = false
  pm.doc.nodesBetween(from, to, node => {
    if (node.isTextblock) {
      if (node.type.canContainMark(type)) relevant = true
      return false
    }
  })
  return relevant
}

NodeType.deriveableCommands = Object.create(null)
MarkType.deriveableCommands = Object.create(null)

MarkType.deriveableCommands.set = () => ({
  run(pm) { pm.setMark(this, true) },
  select(pm) { return canAddInline(pm, this) }
})

MarkType.deriveableCommands.unset = () => ({
  run(pm) { pm.setMark(this, false) },
  select(pm) { return markActive(pm, this) }
})

MarkType.deriveableCommands.toggle = () => ({
  run(pm) { pm.setMark(this, null) },
  active(pm) { return markActive(pm, this) },
  select(pm) { return markApplies(pm, this) }
})

// FIXME figure out a way to get the names into the docs properly

// :: StrongMark #path="schema:strong:set" #kind=command
// Add the [strong](#StrongMark) mark to the selected content.

StrongMark.register("command", {name: "set", derive: true, label: "Set strong"})

// :: StrongMark #path="schema:strong:unset" #kind=command
// Remove the [strong](#StrongMark) mark from the selected content.

StrongMark.register("command", {name: "unset", derive: true, label: "Unset strong"})

// :: StrongMark #path="schema:strong:toggle" #kind=command// Toggle the [strong](#StrongMark) mark. If there is any strong
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the strong mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content strong.
//
// **Keybindings:** Mod-B
//
// Registers itself in the inline [menu](#FIXME).

StrongMark.register("command", {
  name: "toggle",
  derive: true,
  label: "Toggle strong",
  menuGroup: "inline(20)",
  icon: {
    width: 805, height: 1024,
    path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
  },
  keys: ["Mod-B"]
})

// :: EmMark #path=setEm #kind=command
// Add the [emphasis](#EmMark) mark to the selected content.

EmMark.register("command", {name: "set", derive: true, label: "Add emphasis"})

// :: EmMark #path=unsetEm #kind=command
// Remove the [emphasis](#EmMark) mark from the selected content.

EmMark.register("command", {name: "unset", derive: true, label: "Remove emphasis"})

// :: EmMark #path=em #kind=command
// Toggle the [emphasis](#EmMark) mark. If there is any emphasized
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the emphasis mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content emphasized.
//
// **Keybindings:** Mod-I
//
// Registers itself in the inline [menu](#FIXME).

EmMark.register("command", {
  name: "toggle",
  derive: true,
  label: "Toggle emphasis",
  menuGroup: "inline(21)",
  icon: {
    width: 585, height: 1024,
    path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
  },
  keys: ["Mod-I"]
})

// :: CodeMark #path=setCode #kind=command
// Add the [code](#CodeMark) mark to the selected content.

CodeMark.register("command", {name: "set", derive: true, label: "Set code style"})

// :: CodeMark #path=unsetCode #kind=command
// Remove the [code](#CodeMark) mark from the selected content.

CodeMark.register("command", {name: "unset", derive: true, label: "Remove code style"})

// :: CodeMark #path=code #kind=command
// Toggle the [code](#CodeMark) mark. If there is any code-styled
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the code mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// styles the selected content as code.
//
// **Keybindings:** Mod-`
//
// Registers itself in the inline [menu](#FIXME).

CodeMark.register("command", {
  name: "toggle",
  derive: true,
  label: "Toggle code style",
  menuGroup: "inline(22)",
  icon: {
    width: 896, height: 1024,
    path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
  },
  keys: ["Mod-`"]
})

// :: LinkMark #path=unlink #kind=command
// Removes all links for the selected content, or, if there is no
// selection, from the [active marks](#ProseMirror.activeMarks). Will
// only [select](#Command.select) itself when there is a link in the
// selection or active marks.
//
// Registers itself in the inline [menu](#FIXME).

const linkIcon = {
  width: 951, height: 1024,
  path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
}

LinkMark.register("command", {
  name: "unset",
  derive: true,
  label: "Unlink",
  menuGroup: "inline(30)",
  active() { return true },
  icon: linkIcon
})

// :: LinkMark #path=link #kind=command
// Adds a link mark to the selection or set of [active
// marks](#ProseMirror.activeMarks). Takes parameters to determine the
// attributes of the link:
//
// **`href`**`: string`
//   : The link's target.
//
// **`title`**`: string`
//   : The link's title.
//
// Adds itself to the inline [menu](#FIXME). Only selects itself when
// `unlink` isn't selected, so that only one of the two is visible in
// the menu at any time.

LinkMark.register("command", {
  name: "set",
  label: "Add link",
  run(pm, href, title) { pm.setMark(this, true, {href, title}) },
  params: [
    {label: "Target", type: "text"},
    {label: "Title", type: "text", default: ""}
  ],
  select(pm) { return markApplies(pm, this) && !markActive(pm, this) },
  menuGroup: "inline(30)",
  icon: linkIcon
  // FIXME pre-fill params when a single link is selected
  // (If parameter pre-filling is going to continue working like that)
})

// :: Image #path=insertImage #kind=command
// Replace the selection with an [image](#Image) node. Takes paramers
// that specify the image's attributes:
//
// **`src`**`: string`
//   : The URL of the image.
//
// **`alt`**`: string`
//   : The alt text for the image.
//
// **`title`**`: string`
//   : A title for the image.
//
// Registers itself in the inline [menu](#FIXME).

Image.register("command", {
  name: "insert",
  label: "Insert image",
  run(pm, src, alt, title) {
    return pm.tr.replaceSelection(this.create({src, title, alt})).apply(andScroll)
  },
  params: [
    {label: "Image URL", type: "text"},
    {label: "Description / alternative text", type: "text", default: ""},
    {label: "Title", type: "text", default: ""}
  ],
  select(pm) {
    return pm.doc.path(pm.selection.from.path).type.canContainType(this)
  },
  menuGroup: "inline(40)",
  icon: {
    width: 1097, height: 1024,
    path: "M365 329q0 45-32 77t-77 32-77-32-32-77 32-77 77-32 77 32 32 77zM950 548v256h-804v-109l182-182 91 91 292-292zM1005 146h-914q-7 0-12 5t-5 12v694q0 7 5 12t12 5h914q7 0 12-5t5-12v-694q0-7-5-12t-12-5zM1097 164v694q0 37-26 64t-64 26h-914q-37 0-64-26t-26-64v-694q0-37 26-64t64-26h914q37 0 64 26t26 64z"
  },
  prefillParams(pm) {
    let {node} = pm.selection
    if (node && node.type == this)
      return [node.attrs.src, node.attrs.alt, node.attrs.title]
    // FIXME else use the selected text as alt
  }
})

// Get an offset moving backward from a current offset inside a node.
function moveBackward(parent, offset, by) {
  if (by != "char" && by != "word")
    throw new Error("Unknown motion unit: " + by)

  let cat = null, counted = 0
  for (;;) {
    if (offset == 0) return offset
    let {start, node} = parent.chunkBefore(offset)
    if (!node.isText) return cat ? offset : offset - 1

    if (by == "char") {
      for (let i = offset - start; i > 0; i--) {
        if (!isExtendingChar(node.text.charAt(i - 1)))
          return offset - 1
        offset--
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (let i = offset - start; i > 0; i--) {
        let nextCharCat = charCategory(node.text.charAt(i - 1))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset--
        counted++
      }
    }
  }
}

// ;; #path=deleteSelection #kind=command
// Delete the selection, if there is one.
//
// **Keybindings:** Backspace, Delete, Mod-Backspace, Mod-Delete,
// **Ctrl-H (Mac), Alt-Backspace (Mac), Ctrl-D (Mac),
// **Ctrl-Alt-Backspace (Mac), Alt-Delete (Mac), Alt-D (Mac)

defineCommand({
  name: "deleteSelection",
  label: "Delete the selection",
  run(pm) {
    return pm.tr.replaceSelection().apply(andScroll)
  },
  keys: {
    all: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
    mac: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]
  }
})

function deleteBarrier(pm, cut) {
  let around = pm.doc.path(cut.path)
  let before = around.child(cut.offset - 1), after = around.child(cut.offset)
  if (before.type.canContainContent(after.type) && pm.tr.join(cut).apply(andScroll) !== false)
    return

  let conn
  if (after.isTextblock && (conn = before.type.findConnection(after.type))) {
    let tr = pm.tr, end = cut.move(1)
    tr.step("ancestor", cut, end, null, {types: [before.type, ...conn],
                                         attrs: [before.attrs, ...conn.map(() => null)]})
    tr.join(end)
    tr.join(cut)
    if (tr.apply(andScroll) !== false) return
  }

  let selAfter = findSelectionFrom(pm.doc, cut, 1)
  return pm.tr.lift(selAfter.from, selAfter.to).apply(andScroll)
}

// ;; #path=joinBackward #kind=command
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
//
// **Keybindings:** Backspace, Mod-Backspace

defineCommand({
  name: "joinBackward",
  label: "Join with the block above",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0) return false

    // Find the node before this one
    let before, cut
    for (let i = head.path.length - 1; !before && i >= 0; i--) if (head.path[i] > 0) {
      cut = head.shorten(i)
      before = pm.doc.path(cut.path).child(cut.offset - 1)
    }

    // If there is no node before this, try to lift
    if (!before)
      return pm.tr.lift(head).apply(andScroll)

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.tr.delete(cut.move(-1), cut).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Backspace(30)", "Mod-Backspace(30)"]
})

// ;; #path=deleteCharBefore #kind=command
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
//
// **Keybindings:** Backspace, Ctrl-H (Mac)

defineCommand({
  name: "deleteCharBefore",
  label: "Delete a character before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  keys: {
    all: ["Backspace(60)"],
    mac: ["Ctrl-H(40)"]
  }
})

// ;; #path=deleteWordBefore #kind=command
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
//
// **Keybindings:** Mod-Backspace, Alt-Backspace (Mac)

defineCommand({
  name: "deleteWordBefore",
  label: "Delete the word before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  keys: {
    all: ["Mod-Backspace(40)"],
    mac: ["Alt-Backspace(40)"]
  }
})

function moveForward(parent, offset, by) {
  if (by != "char" && by != "word")
    throw new Error("Unknown motion unit: " + by)

  let cat = null, counted = 0
  for (;;) {
    if (offset == parent.size) return offset
    let {start, node} = parent.chunkAfter(offset)
    if (!node.isText) return cat ? offset : offset + 1

    if (by == "char") {
      for (let i = offset - start; i < node.text.length; i++) {
        if (!isExtendingChar(node.text.charAt(i + 1)))
          return offset + 1
        offset++
      }
    } else if (by == "word") {
      for (let i = offset - start; i < node.text.length; i++) {
        let nextCharCat = charCategory(node.text.charAt(i))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset++
        counted++
      }
    }
  }
}

// ;; #path=joinForward #kind=command
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
//
// **Keybindings:** Delete, Mod-Delete

defineCommand({
  name: "joinForward",
  label: "Join with the block below",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset < pm.doc.path(head.path).size) return false

    // Find the node after this one
    let after, cut
    for (let i = head.path.length - 1; !after && i >= 0; i--) {
      cut = head.shorten(i, 1)
      let parent = pm.doc.path(cut.path)
      if (cut.offset < parent.size)
        after = parent.child(cut.offset)
    }

    // If there is no node after this, there's nothing to do
    if (!after) return false

    // If the node doesn't allow children, delete it
    if (after.type.contains == null)
      return pm.tr.delete(cut, cut.move(1)).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Delete(30)", "Mod-Delete(30)"]
})

// ;; #path=deleteCharAfter #kind=command
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
//
// **Keybindings:** Delete, Ctrl-D (Mac)

defineCommand({
  name: "deleteCharAfter",
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).size) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  keys: {
    all: ["Delete(60)"],
    mac: ["Ctrl-D(60)"]
  }
})

// ;; #path=deleteWordAfter #kind=command
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
//
// **Keybindings:** Mod-Delete, Ctrl-Alt-Backspace (Mac), Alt-Delete
// (Mac), Alt-D (Mac)

defineCommand({
  name: "deleteWordAfter",
  label: "Delete a word after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).size) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  keys: {
    all: ["Mod-Delete(40)"],
    mac: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]
  }
})

function joinPointAbove(pm) {
  let {node, from} = pm.selection
  if (node) return joinableBlocks(pm.doc, from) ? from : null
  else return joinPoint(pm.doc, from, -1)
}

// ;; #path=joinUp #kind=command
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
//
// **Keybindings:** Alt-Up
//
// Registers itself in the block [menu](#FIXME)

defineCommand({
  name: "joinUp",
  label: "Join with above block",
  run(pm) {
    let point = joinPointAbove(pm), isNode = pm.selection.node
    if (!point) return false
    pm.tr.join(point).apply()
    if (isNode) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointAbove(pm) },
  menuGroup: "block(80)",
  icon: {
    width: 800, height: 900,
    path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
  },
  keys: ["Alt-Up"]
})

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinableBlocks(pm.doc, to) ? to : null
  else return joinPoint(pm.doc, to, 1)
}

// ;; #path=joinDown #kind=command
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
//
// **Keybindings:** Alt-Down

defineCommand({
  name: "joinDown",
  label: "Join with below block",
  run(pm) {
    let node = pm.selection.node
    let point = joinPointBelow(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (node) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointBelow(pm) },
  keys: ["Alt-Down"]
})

// ;; #path=lift #kind=command
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
//
// **Keybindings:** Alt-Left
//
// Registers itself in the block [menu](#FIXME).

defineCommand({
  name: "lift",
  label: "Lift out of enclosing block",
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.lift(from, to).apply(andScroll)
  },
  select(pm) {
    let {from, to} = pm.selection
    return canLift(pm.doc, from, to)
  },
  menuGroup: "block(75)",
  icon: {
    width: 1024, height: 1024,
    path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
  },
  keys: ["Alt-Left"]
})

function isAtTopOfListItem(doc, from, to, listType) {
  return Pos.samePath(from.path, to.path) &&
    from.path.length >= 2 &&
    from.path[from.path.length - 1] == 0 &&
    listType.canContain(doc.path(from.path.slice(0, from.path.length - 1)))
}

NodeType.deriveableCommands.wrap = conf => ({
  run(pm) {
    let {from, to, head} = pm.selection, doJoin = false
    if (this.isList && head && isAtTopOfListItem(pm.doc, from, to, this)) {
      // Don't do anything if this is the top of the list
      if (from.path[from.path.length - 2] == 0) return false
      doJoin = true
    }
    let tr = pm.tr.wrap(from, to, this, conf.attrs)
    if (doJoin) tr.join(from.shorten(from.depth - 2))
    return tr.apply(andScroll)
  },
  select(pm) {
    let {from, to, head} = pm.selection
    if (this.isList && head && isAtTopOfListItem(pm.doc, from, to, this) &&
        from.path[from.path.length - 2] == 0)
      return false
    return canWrap(pm.doc, from, to, this, conf.attrs)
  }
})

// :: BulletList #path=wrapBulletList #kind=command
// Wrap the selection in a bullet list.
//
// **Keybindings:** Alt-Right '*', Alt-Right '-'
//
// Registers itself in the block [menu](#FIXME).

BulletList.register("command", {
  name: "wrap",
  derive: true,
  labelName: "bullet list",
  menuGroup: "block(40)",
  icon: {
    width: 768, height: 896,
    path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
  },
  keys: ["Alt-Right '*'", "Alt-Right '-'"]
})

// :: OrderedList #path=wrapOrderedList #kind=command
// Wrap the selection in an ordered list.
//
// **Keybindings:** Alt-Right '1'
//
// Registers itself in the block [menu](#FIXME).

OrderedList.register("command", {
  name: "wrap",
  derive: true,
  labelName: "ordered list",
  menuGroup: "block(41)",
  icon: {
    width: 768, height: 896,
    path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
  },
  keys: ["Alt-Right '1'"]
})

// :: BlockQuote #path=wrapBlockQuote #kind=command
// Wrap the selection in a block quote.
//
// **Keybindings:** Alt-Right '>', Alt-Right '"'
//
// Registers itself in the block [menu](#FIXME).

BlockQuote.register("command", {
  name: "wrap",
  derive: true,
  labelName: "block quote",
  menuGroup: "block(45)",
  icon: {
    width: 640, height: 896,
    path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
  },
  keys: ["Alt-Right '>'", "Alt-Right '\"'"]
})

// :: HardBreak #path=insertHardBreak #kind=command
// Replace the selection with a hard break node. If the selection is
// in a node whose [type](#NodeType) has a truthy `isCode` property
// (such as `CodeBlock` in the default schema), a regular newline is
// inserted instead.
//
// **Keybindings:** Mod-Enter, Shift-Enter
HardBreak.register("command", {
  name: "insert",
  label: "Insert hard break",
  run(pm) {
    let {node, from} = pm.selection
    if (node && node.isBlock)
      return false
    else if (pm.doc.path(from.path).type.isCode)
      return pm.tr.typeText("\n").apply(andScroll)
    else
      return pm.tr.replaceSelection(this.create()).apply(andScroll)
  },
  keys: ["Mod-Enter", "Shift-Enter"]
})

// ;; #path=newlineInCode #kind=command
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
//
// **Keybindings:** Enter

defineCommand({
  name: "newlineInCode",
  label: "Insert newline",
  run(pm) {
    let {from, to, node} = pm.selection, block
    if (!node && Pos.samePath(from.path, to.path) &&
        (block = pm.doc.path(from.path)).type.isCode &&
        to.offset < block.size)
      return pm.tr.typeText("\n").apply(andScroll)
    else
      return false
  },
  keys: ["Enter(10)"]
})

// ;; #path=createParagraphNew #kind=command
// If a content-less block node is selected, create an empty paragraph
// before (if it is its parent's first child) or after it.
//
// **Keybindings:** Enter

defineCommand({
  name: "createParagraphNear",
  label: "Create a paragraph near the selected leaf block",
  run(pm) {
    let {from, to, node} = pm.selection
    if (!node || !node.isBlock || node.type.contains) return false
    let side = from.offset ? to : from
    pm.tr.insert(side, pm.schema.defaultTextblockType().create()).apply(andScroll)
    pm.setTextSelection(new Pos(side.toPath(), 0))
  },
  keys: ["Enter(20)"]
})

// ;; #path=liftEmptyBlock #kind=command
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
//
// **Keybindings:** Enter

defineCommand({
  name: "liftEmptyBlock",
  label: "Move current block up",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0 || pm.doc.path(head.path).size) return false
    if (head.depth > 1) {
      let shorter = head.shorten()
      if (shorter.offset > 0 && shorter.offset < pm.doc.path(shorter.path).size - 1 &&
          pm.tr.split(shorter).apply() !== false)
        return
    }
    return pm.tr.lift(head).apply(andScroll)
  },
  keys: ["Enter(30)"]
})

// ;; #path=splitBlock #kind=command
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
//
// **Keybindings:** Enter

defineCommand({
  name: "splitBlock",
  label: "Split the current block",
  run(pm) {
    let {from, to, node} = pm.selection, block = pm.doc.path(to.path)
    if (node && node.isBlock) {
      if (!from.offset) return false
      return pm.tr.split(from).apply(andScroll)
    } else {
      let type = to.offset == block.size ? pm.schema.defaultTextblockType() : null
      return pm.tr.delete(from, to).split(from, 1, type).apply(andScroll)
    }
  },
  keys: ["Enter(60)"]
})

// :: ListItem #path=splitListItem #kind=command
// If the selection is a text selection inside of a child of a list
// item, split that child and the list item, and delete the selection.
//
// **Keybindings:** Enter

ListItem.register("command", {
  name: "split",
  label: "Split the current list item",
  run(pm) {
    let {from, to, node} = pm.selection
    if ((node && node.isBlock) ||
        from.path.length < 2 || !Pos.samePath(from.path, to.path)) return false
    let toParent = from.shorten(), grandParent = pm.doc.path(toParent.path)
    if (grandParent.type != this) return false
    let nextType = to.offset == grandParent.child(toParent.offset).size ? pm.schema.defaultTextblockType() : null
    return pm.tr.delete(from, to).split(from, 2, nextType).apply(andScroll)
  },
  keys: ["Enter(50)"]
})

function alreadyHasBlockType(doc, from, to, type, attrs) {
  let found = false
  if (!attrs) attrs = {}
  doc.nodesBetween(from, to || from, node => {
    if (node.isTextblock) {
      if (node.hasMarkup(type, attrs)) found = true
      return false
    }
  })
  return found
}

NodeType.deriveableCommands.make = conf => ({
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.setBlockType(from, to, this, conf.attrs).apply(andScroll)
  },
  select(pm) {
    let {from, to, node} = pm.selection
    if (node)
      return node.isTextblock && !node.hasMarkup(this, conf.attrs)
    else
      return !alreadyHasBlockType(pm.doc, from, to, this, conf.attrs)
  }
})

function blockTypeCommand(type, mod, labelName, attrs, key) {
  if (!attrs) attrs = {}
  type.register("command", {
    name: "make" + (mod || ""),
    label: "Change to " + labelName,
    run(pm) {
      let {from, to} = pm.selection
      return pm.tr.setBlockType(from, to, this, attrs).apply(andScroll)
    },
    select(pm) {
      let {from, to, node} = pm.selection
      if (node)
        return node.isTextblock && !node.hasMarkup(this, attrs)
      else
        return !alreadyHasBlockType(pm.doc, from, to, this, attrs)
    },
    key
  })
}

// :: Heading #path=makeH_ #kind=command
// The commands `makeH1` to `makeH6` set the textblocks in the
// selection to become headers with the given level.
//
// **Keybindings:** Mod-H '1' through Mod-H '6'

for (let i = 1; i <= 6; i++)
  Heading.register("command", {
    name: "make" + i,
    derive: {name: "make", attrs: {level: i}},
    label: "Change to heading " + i,
    keys: [`Mod-H '${i}'`]
  })

// :: Paragraph #path=makeParagraph #kind=command
// Set the textblocks in the selection to be regular paragraphs.
//
// **Keybindings:** Mod-P

Paragraph.register("command", {
  name: "make",
  derive: true,
  label: "Change to paragraph",
  keys: ["Mod-P"]
})

// :: CodeBlock #path=makeCodeBlock #kind=command
// Set the textblocks in the selection to be code blocks.
//
// **Keybindings:** Mod-\

CodeBlock.register("command", {
  name: "make",
  derive: true,
  label: "Change to code block",
  keys: ["Mod-\\"]
})

// :: HorizontalRule #path=insertHorizontalRule #kind=command
// Replace the selection with a horizontal rule.
//
// **Keybindings:** Mod-Shift-Minus

// FIXME automate attribute reading?
NodeType.deriveableCommands.insert = conf => ({
  run(pm) {
    return pm.tr.replaceSelection(this.create(conf.attrs)).apply(andScroll)
  }
})

HorizontalRule.register("command", {
  name: "insert",
  derive: true,
  label: "Insert horizontal rule",
  keys: ["Mod-Shift--"]
})

// ;; #path=textblockType #kind=command
// Change the type of the selected textblocks. Takes one parameter,
// `type`, which should be a `{type: NodeType, attrs: ?Object}`
// object, giving the new type and its attributes.
//
// Registers itself in the block [menu](#FIXME), where it creates the
// textblock type dropdown.

defineCommand({
  name: "textblockType",
  label: "Change block type",
  run(pm, type) {
    let {from, to} = pm.selection
    return pm.tr.setBlockType(from, to, type.type, type.attrs).apply()
  },
  select(pm) {
    let {node} = pm.selection
    return !node || node.isTextblock
  },
  params: [
    {label: "Type", type: "select", options: listTextblockTypes, default: currentTextblockType, defaultLabel: "Type..."}
  ],
  display: "select",
  menuGroup: "block(10)"
})

Paragraph.prototype.textblockTypes = [{label: "Normal", rank: 10}]
CodeBlock.prototype.textblockTypes = [{label: "Code", rank: 20}]
Heading.prototype.textblockTypes = [1, 2, 3, 4, 5, 6].map(n => ({label: "Head " + n, attrs: {level: n}, rank: 30 + n}))

function listTextblockTypes(pm) {
  let cached = pm.schema.cached.textblockTypes
  if (cached) return cached

  let found = []
  for (let name in pm.schema.nodes) {
    let type = pm.schema.nodes[name]
    if (!type.textblockTypes) continue
    for (let i = 0; i < type.textblockTypes.length; i++) {
      let info = type.textblockTypes[i]
      sortedInsert(found, {label: info.label, value: {type, attrs: info.attrs}, rank: info.rank},
                   (a, b) => a.rank - b.rank)
    }
  }
  return pm.schema.cached.textblockTypes = found
}

function currentTextblockType(pm) {
  let {from, to, node} = pm.selection
  if (!node || node.isInline) {
    if (!Pos.samePath(from.path, to.path)) return null
    node = pm.doc.path(from.path)
  } else if (!node.isTextblock) {
    return null
  }
  let types = listTextblockTypes(pm)
  for (let i = 0; i < types.length; i++) {
    let tp = types[i], val = tp.value
    if (node.hasMarkup(val.type, val.attrs)) return tp
  }
}

function nodeAboveSelection(pm) {
  let sel = pm.selection, i = 0
  if (sel.node) return !!sel.from.depth && sel.from.shorten()
  for (; i < sel.head.depth && i < sel.anchor.depth; i++)
    if (sel.head.path[i] != sel.anchor.path[i]) break
  return i == 0 ? false : sel.head.shorten(i - 1)
}

// ;; #path=selectParentNode #kind=command
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
//
// **Keybindings:** Esc
//
// Registers itself in the block [menu](#FIXME).
defineCommand({
  name: "selectParentNode",
  label: "Select parent node",
  run(pm) {
    let node = nodeAboveSelection(pm)
    if (!node) return false
    pm.setNodeSelection(node)
  },
  select(pm) {
    return nodeAboveSelection(pm)
  },
  menuGroup: "block(90)",
  icon: {text: "\u2b1a", style: "font-weight: bold; vertical-align: 20%"},
  keys: ["Esc"]
})

function moveSelectionBlock(pm, dir) {
  let {from, to, node} = pm.selection
  let side = dir > 0 ? to : from
  return findSelectionFrom(pm.doc, node && node.isBlock ? side : side.shorten(null, dir > 0 ? 1 : 0), dir)
}

function selectNodeHorizontally(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  if (node && node.isInline) {
    pm.setTextSelection(dir > 0 ? to : from)
    return true
  }

  let parent
  if (!node && (parent = pm.doc.path(from.path)) &&
      (dir > 0 ? from.offset < parent.size : from.offset)) {
    let {node: nextNode, start} = dir > 0 ? parent.chunkAfter(from.offset) : parent.chunkBefore(from.offset)
    if (nextNode.type.selectable && start == from.offset - (dir > 0 ? 0 : 1)) {
      pm.setNodeSelection(dir < 0 ? from.move(-1) : from)
      return true
    }
    return false
  }

  let next = moveSelectionBlock(pm, dir)
  if (next && (next instanceof NodeSelection || node)) {
    pm.setSelectionDirect(next)
    return true
  }
  return false
}

// ;; #path=selectNodeLeft #kind=command
// Select the node directly before the cursor, if any.
//
// **Keybindings:** Left, Mod-Left

defineCommand({
  name: "selectNodeLeft",
  label: "Move the selection onto or out of the block to the left",
  run(pm) {
    let done = selectNodeHorizontally(pm, -1)
    if (done) pm.scrollIntoView()
    return done
  },
  keys: ["Left", "Mod-Left"]
})

// ;; #path=selectNodeRight #kind=command
// Select the node directly after the cursor, if any.
//
// **Keybindings:** Right, Mod-Right

defineCommand({
  name: "selectNodeRight",
  label: "Move the selection onto or out of the block to the right",
  run(pm) {
    let done = selectNodeHorizontally(pm, 1)
    if (done) pm.scrollIntoView()
    return done
  },
  keys: ["Right", "Mod-Right"]
})

function selectNodeVertically(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  let leavingTextblock = true
  if (!node || node.isInline)
    leavingTextblock = verticalMotionLeavesTextblock(pm, dir > 0 ? to : from, dir)

  if (leavingTextblock) {
    let next = moveSelectionBlock(pm, dir)
    if (next && (next instanceof NodeSelection)) {
      pm.setSelectionDirect(next)
      if (!node) pm.sel.lastNonNodePos = from
      return true
    }
  }

  if (!node) return false

  if (node.isInline) {
    setDOMSelectionToPos(pm, from)
    return false
  }

  let last = pm.sel.lastNonNodePos
  let beyond = findSelectionFrom(pm.doc, dir < 0 ? from : to, dir)
  if (last && beyond && Pos.samePath(last.path, beyond.from.path)) {
    setDOMSelectionToPos(pm, last)
    return false
  }
  pm.setSelectionDirect(beyond)
  return true
}

// ;; #path=selectNodeUp #kind=command
// Select the node directly above the cursor, if any.
//
// **Keybindings:** Up

defineCommand({
  name: "selectNodeUp",
  label: "Move the selection onto or out of the block above",
  run(pm) {
    let done = selectNodeVertically(pm, -1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  keys: ["Up"]
})

// ;; #path=selectNodeDown #kind=command
// Select the node directly below the cursor, if any.
//
// **Keybindings:** Down

defineCommand({
  name: "selectNodeDown",
  label: "Move the selection onto or out of the block below",
  run(pm) {
    let done = selectNodeVertically(pm, 1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  keys: ["Down"]
})

// ;; #path=undo #kind=command
// Undo the most recent change event, if any.
//
// **Keybindings:** Mod-Z
//
// Registers itself in the history [menu](#FIXME).

defineCommand({
  name: "undo",
  label: "Undo last change",
  run(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.canUndo() },
  menuGroup: "history(10)",
  icon: {
    width: 1024, height: 1024,
    path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
  },
  keys: ["Mod-Z"]
})

// ;; #path=redo #kind=command
// Redo the most recently undone change event, if any.
//
// **Keybindings:** Mod-Y, Shift-Mod-Z
//
// Registers itself in the history [menu](#FIXME).

defineCommand({
  name: "redo",
  label: "Redo last undone change",
  run(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.canRedo() },
  menuGroup: "history(20)",
  icon: {
    width: 1024, height: 1024,
    path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
  },
  keys: ["Mod-Y", "Shift-Mod-Z"]
})

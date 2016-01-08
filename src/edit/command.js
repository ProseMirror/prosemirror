import Keymap from "browserkeymap"

import {Pos, NodeType, MarkType} from "../model"
import {canWrap} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"
import {NamespaceError, AssertionError} from "../util/error"

const commands = Object.create(null)

const paramHandlers = Object.create(null)

// :: (CommandSpec)
// Define a globally available command. Note that
// [namespaces](#include) can still be used to prevent the command
// from showing up in editor where you don't want it to show up.
export function defineCommand(spec) {
  if (commands[spec.name])
    NamespaceError.raise("Duplicate definition of command " + spec.name)
  commands[spec.name] = spec
}

// ;; A command is a named piece of functionality that can be bound to
// a key, shown in the menu, or otherwise exposed to the user.
//
// The commands available in a given editor are gathered from the
// commands defined with `defineCommand`, and from
// [specs](#CommandSpec) associated with node and mark types in the
// editor's [schema](#Schema.registry). Use the
// [`register`](#SchemaItem.register) method with `"command"` as the
// name and a `CommandSpec` as value to associate a command with a
// node or mark.
//
// This module defines a [bunch of commands](#edit_commands) in the
// [default schema](#defaultSchema) and global command registry.
export class Command {
  constructor(spec, self, name) {
    // :: string The name of the command.
    this.name = name || spec.name
    if (!this.name) NamespaceError.raise("Trying to define a command without a name")
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

// ;; #path=CommandSpec #kind=interface
// Commands are defined using objects that specify various aspects of
// the command. The only properties that _must_ appear in a command
// spec are [`name`](#CommandSpec.name) and [`run`](#CommandSpec.run).
// You should probably also give your commands a `label`.

// :: string #path=CommandSpec.name
// The name of the command, which will be its key in
// `ProseMirror.commands`, and the thing passed to
// [`execCommand`](#ProseMirror.execCommand). Can be
// [namespaced](#include), (and probably should, for user-defined
// commands).

// :: string #path=CommandSpec.label
// A user-facing label for the command. This will be used, among other
// things. as the tooltip title for the command's menu item. If there
// is no `label`, the command's `name` will be used instead.

// :: (pm: ProseMirror, ...params: [any]) → ?bool #path=CommandSpec.run
// The function that executes the command. If the command has
// [parameters](#CommandSpec.params), their values are passed as
// arguments. For commands [registered](#SchemaItem.register) on node or
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
// of strings containing [key
// names](https://github.com/marijnh/browserkeymap#a-string-notation-for-key-events),
// or an object with optional `all`, `mac`, and `pc` properties,
// specifying arrays of keys for different platforms.

// :: union<bool, Object> #path=CommandSpec.derive
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

// ;; #path=CommandParam #kind=interface
// The parameters that a command can take are specified using objects
// with the following properties:

// :: string #path=CommandParam.label
// The user-facing name of the parameter. Shown to the user when
// prompting for this parameter.

// :: string #path=CommandParam.type
// The type of the parameter. Supported types are `"text"` and `"select"`.

// :: any #path=CommandParam.default
// A default value for the parameter.

// :: (pm) → ?any #path=CommandParam.prefill
// A function that, given an editor instance (and a `this` bound to
// the command's source item), tries to derive an initial value for
// the parameter, or return null if it can't.

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
    if (!pm.isIncluded(name)) return
    if (found[name]) NamespaceError.raise("Duplicate definition of command " + name)
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
      if (!derive) AssertionError.raise("Don't know how to derive command " + dname)
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

function selectedMarkAttr(pm, type, attr) {
  let {from, to, empty} = pm.selection
  let start, end
  if (empty) {
    start = end = type.isInSet(pm.activeMarks())
  } else {
    let startParent = pm.doc.path(from.path)
    let startChunk = startParent.size > from.offset && startParent.chunkAfter(from.offset)
    start = startChunk ? type.isInSet(startChunk.node.marks) : null
    end = type.isInSet(pm.doc.marksAt(to))
  }
  if (start && end && start.attrs[attr] == end.attrs[attr])
    return start.attrs[attr]
}

export function selectedNodeAttr(pm, type, name) {
  let {node} = pm.selection
  if (node && node.type == type) return node.attrs[name]
}

function deriveParams(type, params) {
  return params && params.map(param => {
    let attr = type.attrs[param.attr]
    return {
      label: param.label,
      type: param.type || "text",
      default: param.default || attr.default,
      prefill: param.prefill ||
        (type instanceof NodeType
         ? function(pm) { return selectedNodeAttr(pm, this, param.attr) }
         : function(pm) { return selectedMarkAttr(pm, this, param.attr) })
    }
  })
}

function fillAttrs(conf, givenParams) {
  let attrs = conf.attrs
  if (conf.params) {
    let filled = Object.create(null)
    if (attrs) for (let name in attrs) filled[name] = attrs[name]
    conf.params.forEach((param, i) => filled[param.attr] = givenParams[i])
    attrs = filled
  }
  return attrs
}

NodeType.deriveableCommands = Object.create(null)
MarkType.deriveableCommands = Object.create(null)

MarkType.deriveableCommands.set = function(conf) {
  return {
    run(pm, ...params) {
      pm.setMark(this, true, fillAttrs(conf, params))
    },
    select(pm) {
      return conf.inverseSelect
        ? markApplies(pm, this) && !markActive(pm, this)
        : canAddInline(pm, this)
    },
    params: deriveParams(this, conf.params)
  }
}

MarkType.deriveableCommands.unset = () => ({
  run(pm) { pm.setMark(this, false) },
  select(pm) { return markActive(pm, this) }
})

MarkType.deriveableCommands.toggle = () => ({
  run(pm) { pm.setMark(this, null) },
  active(pm) { return markActive(pm, this) },
  select(pm) { return markApplies(pm, this) }
})

function isAtTopOfListItem(doc, from, to, listType) {
  return Pos.samePath(from.path, to.path) &&
    from.path.length >= 2 &&
    from.path[from.path.length - 1] == 0 &&
    listType.canContain(doc.path(from.path.slice(0, from.path.length - 1)))
}

NodeType.deriveableCommands.wrap = function(conf) {
  return {
    run(pm, ...params) {
      let {from, to, head} = pm.selection, doJoin = false
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this)) {
        // Don't do anything if this is the top of the list
        if (from.path[from.path.length - 2] == 0) return false
        doJoin = true
      }
      let tr = pm.tr.wrap(from, to, this, fillAttrs(conf, params))
      if (doJoin) tr.join(from.shorten(from.depth - 2))
      return tr.apply(pm.apply.scroll)
    },
    select(pm) {
      let {from, to, head} = pm.selection
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this) &&
          from.path[from.path.length - 2] == 0)
        return false
      return canWrap(pm.doc, from, to, this, conf.attrs)
    },
    params: deriveParams(this, conf.params)
  }
}

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
    return pm.tr.setBlockType(from, to, this, conf.attrs).apply(pm.apply.scroll)
  },
  select(pm) {
    let {from, to, node} = pm.selection
    if (node)
      return node.isTextblock && !node.hasMarkup(this, conf.attrs)
    else
      return !alreadyHasBlockType(pm.doc, from, to, this, conf.attrs)
  }
})

NodeType.deriveableCommands.insert = function(conf) {
  return {
    run(pm, ...params) {
      return pm.tr.replaceSelection(this.create(fillAttrs(conf, params))).apply(pm.apply.scroll)
    },
    select: this.isInline ? function(pm) {
      return pm.doc.path(pm.selection.from.path).type.canContainType(this)
    } : null,
    params: deriveParams(this, conf.params)
  }
}

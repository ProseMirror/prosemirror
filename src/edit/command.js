import Keymap from "browserkeymap"

import {NodeType, MarkType} from "../model"
import {canWrap} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"
import {copyObj} from "../util/obj"

import {baseCommands} from "./base_commands"

// ;; A command is a named piece of functionality that can be bound to
// a key, shown in the menu, or otherwise exposed to the user.
//
// The commands available in a given editor are determined by the
// `commands` option. By default, they come from the `baseCommands`
// object and the commands [registered](#SchemaItem.register) with
// schema items. Registering a `CommandSpec` on a [node](#NodeType) or
// [mark](#MarkType) type will cause that command to come into scope
// in editors whose schema includes that item.
export class Command {
  constructor(spec, self, name) {
    // :: string The name of the command.
    this.name = name
    if (!this.name) throw new RangeError("Trying to define a command without a name")
    // :: CommandSpec The command's specifying object.
    this.spec = spec
    this.self = self
  }

  // :: (ProseMirror, ?[any]) → ?bool
  // Execute this command. If the command takes
  // [parameters](#Command.params), they can be passed as second
  // argument here, or otherwise the user will be prompted for them
  // using the value of the `commandParamPrompt` option.
  //
  // Returns the value returned by the command spec's [`run`
  // method](#CommandSpec.run), or a `ParamPrompt` instance if the
  // command is ran asynchronously through a prompt.
  exec(pm, params) {
    let run = this.spec.run
    if (!params) {
      if (!this.params.length) return run.call(this.self, pm)
      return new pm.options.commandParamPrompt(pm, this).open()
    } else {
      if (this.params.length != (params ? params.length : 0))
        throw new RangeError("Invalid amount of parameters for command " + this.name)
      return run.call(this.self, pm, ...params)
    }
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

function deriveCommandSpec(type, spec, name) {
  if (!spec.derive) return spec
  let conf = typeof spec.derive == "object" ? spec.derive : {}
  let dname = conf.name || name
  let derive = type.constructor.derivableCommands[dname]
  if (!derive) throw new RangeError("Don't know how to derive command " + dname)
  let derived = derive.call(type, conf)
  for (let prop in spec) if (prop != "derive") derived[prop] = spec[prop]
  return derived
}

// ;; The type used as the value of the `commands` option. Allows you
// to specify the set of commands that are available in the editor by
// adding and modifying command specs.
export class CommandSet {
  constructor(base, op) {
    this.base = base
    this.op = op
  }

  // :: (union<Object<CommandSpec>, "schema">, ?(string, CommandSpec) → bool) → CommandSet
  // Add a set of commands, creating a new command set. If `set` is
  // the string `"schema"`, the commands are retrieved from the
  // editor's schema's [registry](#Schema.registry), otherwise, it
  // should be an object mapping command names to command specs.
  //
  // A filter function can be given to add only the commands for which
  // the filter returns true.
  add(set, filter) {
    return new CommandSet(this, (commands, schema) => {
      function add(name, spec, self) {
        if (!filter || filter(name, spec)) {
          if (commands[name]) throw new RangeError("Duplicate definition of command " + name)
          commands[name] = new Command(spec, self, name)
        }
      }

      if (set === "schema") {
        schema.registry("command", (name, spec, type, typeName) => {
          add(typeName + ":" + name, deriveCommandSpec(type, spec, name), type)
        })
      } else {
        for (let name in set) add(name, set[name])
      }
    })
  }

  // :: (Object<?CommandSpec>) → CommandSet
  // Create a new command set by adding, modifying, or deleting
  // commands. The `update` object can map a command name to `null` to
  // delete it, to a full `CommandSpec` (containing a `run` property)
  // to add it, or to a partial `CommandSpec` (without a `run`
  // property) to update some properties in the command by that name.
  update(update) {
    return new CommandSet(this, commands => {
      for (let name in update) {
        let spec = update[name]
        if (!spec) {
          delete commands[name]
        } else if (spec.run) {
          commands[name] = new Command(spec, null, name)
        } else {
          let known = commands[name]
          if (known)
            commands[name] = new Command(copyObj(spec, copyObj(known.spec)), known.self, name)
        }
      }
    })
  }

  derive(schema) {
    let commands = this.base ? this.base.derive(schema) : Object.create(null)
    this.op(commands, schema)
    return commands
  }
}

// :: CommandSet
// A set without any commands.
CommandSet.empty = new CommandSet(null, () => null)

// :: CommandSet
// The default value of the `commands` option. Includes the [base
// commands](#baseCommands) and the commands defined by the schema.
CommandSet.default = CommandSet.empty.add("schema").add(baseCommands)

// ;; #path=CommandSpec #kind=interface
// Commands are defined using objects that specify various aspects of
// the command. The only property that _must_ appear in a command spec
// is [`run`](#CommandSpec.run). You should probably also give your
// commands a `label`.

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

// :: union<Object<[string]>, [string]> #path=CommandSpec.keys
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

// :: (ProseMirror) → ?any #path=CommandParam.prefill
// A function that, given an editor instance (and a `this` bound to
// the command's source item), tries to derive an initial value for
// the parameter, or return null if it can't.

// :: (any) → ?string #path=CommandParam.validate
// An optional function that is called to validate values provided for
// this parameter. Should return a falsy value when the value is
// valid, and an error message when it is not.

function deriveKeymap(pm) {
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
    if (Array.isArray(keys)) {
      add(cmd, keys)
    } else {
      if (keys.all) add(cmd, keys.all)
      if (keys[platform]) add(cmd, keys[platform])
    }
  }

  for (let key in bindings)
    bindings[key] = bindings[key].map(b => b.command.name)
  return new Keymap(bindings)
}

export function updateCommands(pm, set) {
  // :: () #path=ProseMirror#events#commandsChanging
  // Fired before the set of commands for the editor is updated.
  pm.signal("commandsChanging")
  pm.commands = set.derive(pm.schema)
  pm.input.baseKeymap = deriveKeymap(pm)
  pm.commandKeys = Object.create(null)
  // :: () #path=ProseMirror#events#commandsChanged
  // Fired when the set of commands for the editor is updated.
  pm.signal("commandsChanged")
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
    return !type.isInSet(pm.activeMarks()) && pm.doc.resolve(from).parent.type.canContainMark(type)
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
    let startChunk = pm.doc.resolve(from).nodeAfter
    start = startChunk ? type.isInSet(startChunk.marks) : null
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
    let obj = {type: "text",
               default: attr.default,
               prefill: type instanceof NodeType
                 ? function(pm) { return selectedNodeAttr(pm, this, param.attr) }
                 : function(pm) { return selectedMarkAttr(pm, this, param.attr) }}
    for (let prop in param) obj[prop] = param[prop]
    return obj
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

NodeType.derivableCommands = Object.create(null)
MarkType.derivableCommands = Object.create(null)

MarkType.derivableCommands.set = function(conf) {
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

MarkType.derivableCommands.unset = () => ({
  run(pm) { pm.setMark(this, false) },
  select(pm) { return markActive(pm, this) }
})

MarkType.derivableCommands.toggle = () => ({
  run(pm) { pm.setMark(this, null) },
  active(pm) { return markActive(pm, this) },
  select(pm) { return markApplies(pm, this) }
})

function isAtTopOfListItem(doc, from, to, listType) {
  let $from = doc.resolve(from)
  return $from.sameParent(doc.resolve(to)) &&
    $from.depth >= 2 &&
    $from.index($from.depth - 1) == 0 &&
    listType.canContain($from.node($from.depth - 1))
}

NodeType.derivableCommands.wrap = function(conf) {
  return {
    run(pm, ...params) {
      let {from, to, head} = pm.selection, doJoin = false
      let $from = pm.doc.resolve(from)
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this)) {
        // Don't do anything if this is the top of the list
        if ($from.index($from.depth - 2) == 0) return false
        doJoin = true
      }
      let tr = pm.tr.wrap(from, to, this, fillAttrs(conf, params))
      if (doJoin) tr.join($from.before($from.depth - 1))
      return tr.apply(pm.apply.scroll)
    },
    select(pm) {
      let {from, to, head} = pm.selection, $from
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this) &&
          ($from = pm.doc.resolve(from)).index($from.depth - 2) == 0)
        return false
      return canWrap(pm.doc, from, to, this)
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

function activeTextblockIs(pm, type, attrs) {
  let {from, to, node} = pm.selection
  if (!node || node.isInline) {
    let $from = pm.doc.resolve(from)
    if (!$from.sameParent(pm.doc.resolve(to))) return false
    node = $from.parent
  } else if (!node.isTextblock) {
    return false
  }
  return node.hasMarkup(type, attrs)
}

NodeType.derivableCommands.make = conf => ({
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.setBlockType(from, to, this, conf.attrs).apply(pm.apply.scroll)
  },
  // FIXME deal with situations where not all text blocks have the same kind
  select(pm) {
    let {from, to, node} = pm.selection
    if (node)
      return node.isTextblock && !node.hasMarkup(this, conf.attrs)
    else
      return !alreadyHasBlockType(pm.doc, from, to, this, conf.attrs)
  },
  active(pm) {
    return activeTextblockIs(pm, this, conf.attrs)
  }
})

NodeType.derivableCommands.insert = function(conf) {
  return {
    run(pm, ...params) {
      return pm.tr.replaceSelection(this.create(fillAttrs(conf, params))).apply(pm.apply.scroll)
    },
    select: this.isInline ? function(pm) {
      return pm.doc.resolve(pm.selection.from).parent.type.canContainType(this)
    } : null,
    params: deriveParams(this, conf.params)
  }
}

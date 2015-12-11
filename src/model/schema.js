import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"

import {ProseMirrorError} from "../util/error"

// ;; The exception type used to signal schema-related errors.
export class SchemaError extends ProseMirrorError {}

function findKinds(type, name, schema, override) {
  function set(sub, sup) {
    if (sub in schema.kinds) {
      if (schema.kinds[sub] == sup) return
      SchemaError.raise(`Inconsistent superkinds for kind ${sub}: ${sup} and ${schema.kinds[sub]}`)
    }
    if (schema.subKind(sub, sup))
      SchemaError.raise(`Conflicting kind hierarchy through ${sub} and ${sup}`)
    schema.kinds[sub] = sup
  }

  for (let cur = type;; cur = Object.getPrototypeOf(cur)) {
    let curKind = override != null && cur == type ? override : cur.kind
    if (curKind != null) {
      let [_, kind, end] = /^(.*?)(\.)?$/.exec(curKind)
      if (kind) {
        set(name, kind)
        name = kind
      }
      if (end) {
        set(name, null)
        return
      }
    }
  }
}

// ;; Node types are objects allocated once per [`Schema`](#Schema)
// and used to tag [`Node`](#Node) instances with a type. They are
// instances of subtypes of this class, and contain information about
// the node type (its name, its allowed attributes, methods for
// serializing it to various formats, information to guide
// deserialization, and so on).
export class NodeType {
  constructor(name, contains, attrs, schema) {
    // :: string
    // The name the node type has in this schema.
    this.name = name
    // :: ?string
    // The kind of nodes this node may contain. `null` means it's a
    // leaf node.
    this.contains = contains
    // :: Object<Attribute>
    // The attributes allowed on this node type.
    this.attrs = attrs
    // :: Schema
    // A link back to the [`Schema`](#Schema) the node type belongs to.
    this.schema = schema
    this.defaultAttrs = null
  }

  // :: bool
  // True if this is a block type.
  get isBlock() { return false }

  // :: bool
  // True if this is a textblock type, a block that contains inline
  // content.
  get isTextblock() { return false }

  // :: bool
  // True if this is an inline type.
  get isInline() { return false }

  // :: bool
  // True if this is the text node type.
  get isText() { return false }

  // :: bool
  // Controls whether nodes of this type can be selected (as a user
  // node selection).
  get selectable() { return true }

  // :: bool
  // Controls whether this node type is locked.
  get locked() { return false }

  // :: string
  // Controls the _kind_ of the node, which is used to determine valid
  // parent/child relations. Can be a word, which adds that kind to
  // the set of kinds of the superclass, a word followed by a dot, to
  // ignore the kinds of the superclass and use only that word (along
  // with the node's name) as kind, or only a dot, in which case the
  // only kind the node has is its own name.
  static get kind() { return "." }

  // :: (Fragment) → bool
  // Test whether the content of the given fragment could be contained
  // in this node type.
  canContainFragment(fragment) {
    let ok = true
    fragment.forEach(n => { if (!this.canContain(n)) ok = false })
    return ok
  }

  // :: (Node) → bool
  // Test whether the given node could be contained in this node type.
  canContain(node) {
    if (!this.canContainType(node.type)) return false
    for (let i = 0; i < node.marks.length; i++)
      if (!this.canContainMark(node.marks[i])) return false
    return true
  }

  // :: (Mark) → bool
  // Test whether this node type can contain children with the given
  // mark.
  canContainMark(mark) {
    let contains = this.containsMarks
    if (contains === true) return true
    if (contains) for (let i = 0; i < contains.length; i++)
      if (contains[i] == mark.name) return true
    return false
  }

  // :: (NodeType) → bool
  // Test whether this node type can contain nodes of the given node
  // type.
  canContainType(type) {
    return this.schema.subKind(type.name, this.contains)
  }

  // :: (NodeType) → bool
  // Test whether the nodes that can be contained in the given node
  // type are a subtype of the nodes that can be contained in this
  // type.
  canContainContent(type) {
    return this.schema.subKind(type.contains, this.contains)
  }

  // :: (NodeType) → [NodeType]
  // Find a set of intermediate node types, possibly empty, that have
  // to be inserted between this type and `other` to put a node of
  // type `other` into this type.
  findConnection(other) {
    // FIXME be more careful about order, and about chosen nodes
    // having default attrs
    if (this.canContainType(other)) return []

    let seen = Object.create(null)
    let active = [{from: this, via: []}]
    while (active.length) {
      let current = active.shift()
      for (let name in this.schema.nodes) {
        let type = this.schema.nodeType(name)
        if (!(type.contains in seen) && current.from.canContainType(type)) {
          let via = current.via.concat(type)
          if (type.canContainType(other)) return via
          active.push({from: type, via: via})
          seen[type.contains] = true
        }
      }
    }
  }

  buildAttrs(attrs, content) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return buildAttrs(this.attrs, attrs, this, content)
  }

  // :: (?Object, ?Fragment, ?[Mark]) → Node
  // Create a [`Node`](#Node) of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a [`Fragment`](#Fragment), a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  create(attrs, content, marks) {
    return new Node(this, this.buildAttrs(attrs, content), Fragment.from(content), marks)
  }

  createAutoFill(attrs, content, marks) {
    if ((!content || content.length == 0) && !this.canBeEmpty)
      content = this.defaultContent()
    return this.create(attrs, content, marks)
  }

  // :: bool
  // Controls whether this node is allowed to be empty.
  get canBeEmpty() { return true }

  static compile(types, schema) {
    let result = Object.create(null)
    for (let name in types) {
      let info = types[name]
      let type = info.type || SchemaError.raise("Missing node type for " + name)
      findKinds(type, name, schema, info.kind)
      let contains = "contains" in info ? info.contains : type.contains
      result[name] = new type(name, contains, info.attributes || type.attributes, schema)
    }
    for (let name in result) {
      let contains = result[name].contains
      if (contains && !(contains in schema.kinds))
        SchemaError.raise("Node type " + name + " is specified to contain non-existing kind " + contains)
    }
    if (!result.doc) SchemaError.raise("Every schema needs a 'doc' type")
    if (!result.text) SchemaError.raise("Every schema needs a 'text' type")

    for (let name in types)
      types[name].defaultAttrs = getDefaultAttrs(types[name].attrs)
    return result
  }

  // :: (string, *)
  // Register a metadata element for this type. That is, add `value`
  // to the array under the property name `name` on the type's
  // prototype, creating the array if it wasn't already there. This is
  // mostly used to attach things like commands and parsing strategies
  // to node type.
  static register(name, value) {
    ;(this.prototype[name] || (this.prototype[name] = [])).push(value)
  }

  // :: union<bool, [string]>
  // The mark types that child nodes of this node may have. `false`
  // means no marks, `true` means any mark, and an array of strings
  // can be used to explicitly list the allowed mark types.
  get containsMarks() { return false }
}

// :: Object<Attribute>
// The default set of attributes to associate with a given type. Note
// that schemas may add additional attributes to instances of the
// type.
NodeType.attributes = {}

// ;; Base type for block nodetypes.
export class Block extends NodeType {
  static get contains() { return "block" }
  static get kind() { return "block." }
  get isBlock() { return true }

  get canBeEmpty() { return this.contains == null }

  defaultContent() {
    let inner = this.schema.defaultTextblockType().create()
    let conn = this.findConnection(inner.type)
    if (!conn) SchemaError.raise("Can't create default content for " + this.name)
    for (let i = conn.length - 1; i >= 0; i--) inner = conn[i].create(null, inner)
    return Fragment.from(inner)
  }
}

// ;; Base type for textblock node types.
export class Textblock extends Block {
  static get contains() { return "inline" }
  get containsMarks() { return true }
  get isTextblock() { return true }
  get canBeEmpty() { return true }
}

// ;; Base type for inline node types.
export class Inline extends NodeType {
  static get contains() { return null }
  static get kind() { return "inline." }
  get isInline() { return true }
}

// ;; The text node type.
export class Text extends Inline {
  get selectable() { return false }
  get isText() { return true }

  create(attrs, content, marks) {
    return new TextNode(this, this.buildAttrs(attrs, content), content, marks)
  }
}

// Attribute descriptors

// ;; Attributes are named strings associated with nodes and marks.
// Each node type or mark type has a fixed set of attributes, which
// instances of this class are used to control.
export class Attribute {
  // :: (Object)
  // Create an attribute. `options` is an object containing the
  // settings for the attributes. The following settings are
  // supported:
  //
  // **`default`**: `?string`
  // : The default value for this attribute, to choose when no
  //   explicit value is provided.
  //
  // **`compute`**: `?(Fragment) → string`
  // : A function that computes a default value for the attribute from
  //   the node's content.
  //
  // Attributes that have no default or compute property must be
  // provided whenever a node or mark of a type that has them is
  // created.
  constructor(options = {}) {
    this.default = options.default
    this.compute = options.compute
  }
}

// Marks

// ;; Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are tagged with type
// objects, which are instantiated once per [Schema](#Schema).
export class MarkType {
  constructor(name, attrs, rank, schema) {
    // :: string
    // The name of the mark type.
    this.name = name
    // :: Object<Attribute>
    // The attributes supported by this type of mark.
    this.attrs = attrs
    this.rank = rank
    // :: Schema
    // The schema that this mark type instance is part of.
    this.schema = schema
    let defaults = getDefaultAttrs(this.attrs)
    this.instance = defaults && new Mark(this, defaults)
  }

  // :: number
  // Mark type ranks are used to determine the order in which mark
  // arrays are sorted. (If multiple mark types end up with the same
  // rank, they still get a fixed order in the schema, but there's no
  // guarantee what it will be.)
  static get rank() { return 50 }

  // :: (Object) → Mark
  // Create a mark of this type. `attrs` may be `null` or an object
  // containing only some of the mark's attributes. The others, if
  // they have defaults, will be added.
  create(attrs) {
    if (!attrs && this.instance) return this.instance
    return new Mark(this, buildAttrs(this.attrs, attrs, this))
  }

  static getOrder(marks) {
    let sorted = []
    for (let name in marks) sorted.push({name, rank: marks[name].type.rank})
    sorted.sort((a, b) => a.rank - b.rank)
    let ranks = Object.create(null)
    for (let i = 0; i < sorted.length; i++) ranks[sorted[i].name] = i
    return ranks
  }

  static compile(marks, schema) {
    let order = this.getOrder(marks)
    let result = Object.create(null)
    for (let name in marks) {
      let info = marks[name]
      let attrs = info.attributes || info.type.attributes
      result[name] = new info.type(name, attrs, order[name], schema)
    }
    return result
  }

  // :: ([Mark]) → [Mark]
  // When there is a mark of this type in the given set, a new set
  // without it is returned. Otherwise, the input set is returned.
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (set[i].type == this)
        return set.slice(0, i).concat(set.slice(i + 1))
    return set
  }

  // :: ([Mark]) → bool
  // Tests whether there is a mark of this type in the given set.
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (set[i].type == this) return set[i]
  }

  // :: (string, *)
  // Register a metadata element for this mark type. Adds `value` to
  // the array under the property name `name` on the type's prototype.
  static register(name, value) {
    ;(this.prototype[name] || (this.prototype[name] = [])).push(value)
  }
}

// :: Object<Attribute>
// The default set of attributes to associate with a mark type. By
// default, this returns an empty object.
MarkType.attributes = {}

// Schema specifications are data structures that specify a schema --
// a set of node types, their names, attributes, and nesting behavior.

function copyObj(obj, f) {
  let result = Object.create(null)
  for (let prop in obj) result[prop] = f ? f(obj[prop]) : obj[prop]
  return result
}

function ensureWrapped(obj) {
  return obj instanceof Function ? {type: obj} : obj
}

function overlayObj(obj, overlay) {
  let copy = copyObj(obj)
  for (let name in overlay) {
    let info = ensureWrapped(overlay[name])
    if (info == null) {
      delete copy[name]
    } else if (info.type) {
      copy[name] = info
    } else {
      let existing = copy[name] = copyObj(copy[name])
      for (let prop in info)
        existing[prop] = info[prop]
    }
  }
  return copy
}

// FIXME clean up handling of attributes, finish documentation.

// ;; A schema specification is a blueprint for an actual
// [`Schema`](#Schema). It maps names to node and mark types, along
// with extra information, such as additional attributes and changes
// to node kinds and relations.
//
// A specification consists of an object that maps node names to node
// type constructors and another similar object mapping mark names to
// mark type constructors.
export class SchemaSpec {
  // :: (?Object<{type: NodeType}>, ?Object<{type: MarkType}>)

  // Create a schema specification from scratch. The arguments map
  // node names to node type constructors and mark names to mark type
  // constructors. Their property value should be either the type
  // constructors themselves, or objects with a type constructor under
  // their `type` property, and optionally other properties.
  constructor(nodes, marks) {
    this.nodes = nodes ? copyObj(nodes, ensureWrapped) : Object.create(null)
    this.marks = marks ? copyObj(marks, ensureWrapped) : Object.create(null)
  }

  updateNodes(nodes) {
    return new SchemaSpec(overlayObj(this.nodes, nodes), this.marks)
  }

  addAttribute(filter, attrName, attrInfo) {
    let copy = copyObj(this.nodes)
    for (let name in copy) {
      if (typeof filter == "string" ? filter == name :
          typeof filter == "function" ? filter(name, copy[name]) :
          filter ? filter == copy[name] : true) {
        let info = copy[name] = copyObj(copy[name])
        if (!info.attributes) info.attributes = copyObj(info.type.attributes)
        info.attributes[attrName] = attrInfo
      }
    }
    return new SchemaSpec(copy, this.marks)
  }

  updateMarks(marks) {
    return new SchemaSpec(this.nodes, overlayObj(this.marks, marks))
  }
}

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.

function getDefaultAttrs(attrs) {
  let defaults = Object.create(null)
  for (let attrName in attrs) {
    let attr = attrs[attrName]
    if (attr.default == null) return null
    defaults[attrName] = attr.default
  }
  return defaults
}

function buildAttrs(attrSpec, attrs, arg1, arg2) {
  let built = Object.create(null)
  for (let name in attrSpec) {
    let value = attrs && attrs[name]
    if (value == null) {
      let attr = attrSpec[name]
      if (attr.default != null)
        value = attr.default
      else if (attr.compute)
        value = attr.compute(arg1, arg2)
      else
        SchemaError.raise("No value supplied for attribute " + name)
    }
    built[name] = value
  }
  return built
}

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).
export class Schema {
  // :: (SchemaSpec)
  // Construct a schema from a specification.
  constructor(spec) {
    // :: SchemaSpec
    // The specification on which the schema is based.
    this.spec = spec
    this.kinds = Object.create(null)
    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(spec.nodes, this)
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(spec.marks, this)
    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null)

    this.node = this.node.bind(this)
    this.text = this.text.bind(this)
    this.nodeFromJSON = this.nodeFromJSON.bind(this)
    this.markFromJSON = this.markFromJSON.bind(this)
  }

  // FIXME normalize mark arrays passed to these methods

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // [`NodeType`](#NodeType) instance. Attributes will be extended
  // with defaults, `content` may be a [`Fragment`](#Fragment),
  // `null`, a [`Node`](#Node), or an array of nodes.
  //
  // When creating a text node, `content` should be a string and is
  // interpreted as the node's text.
  //
  // This method is bound to the Schema, meaning you don't have to
  // call it as a method, but can pass it to higher-order functions
  // and such.
  node(type, attrs, content, marks) {
    if (typeof type == "string")
      type = this.nodeType(type)
    else if (!(type instanceof NodeType))
      SchemaError.raise("Invalid node type: " + type)
    else if (type.schema != this)
      SchemaError.raise("Node type from different schema used (" + type.name + ")")

    return type.create(attrs, content, marks)
  }

  // :: (string, ?[Mark]) → Node
  // Create a text node in the schema. This method is bound to the Schema.
  text(text, marks) {
    return this.nodes.text.create(null, text, marks)
  }

  // :: () → ?NodeType
  // Return the default textblock type for this schema, or `null` if
  // it does not contain a node type with a `defaultTextblock`
  // property.
  defaultTextblockType() {
    let cached = this.cached.defaultTextblockType
    if (cached !== undefined) return cached
    for (let name in this.nodes) {
      if (this.nodes[name].defaultTextblock)
        return this.cached.defaultTextblockType = this.nodes[name]
    }
    return this.cached.defaultTextblockType = null
  }

  // :: (string, ?Object) → Mark
  // Create a mark with the named type
  mark(name, attrs) {
    let spec = this.marks[name] || SchemaError.raise("No mark named " + name)
    return spec.create(attrs)
  }

  // :: (Object) → Node
  // Deserialize a node from its JSON representation. This method is
  // bound.
  nodeFromJSON(json) {
    return Node.fromJSON(this, json)
  }

  // :: (Object) → Mark
  // Deserialize a mark from its JSON representation. This method is
  // bound.
  markFromJSON(json) {
    if (typeof json == "string") return this.mark(json)
    return this.mark(json._, json)
  }

  // :: (string) → NodeType
  // Get the [`NodeType`](#NodeType) associated with the given name in
  // this schema, or raise an error if it does not exist.
  nodeType(name) {
    return this.nodes[name] || SchemaError.raise("Unknown node type: " + name)
  }

  // :: (string, string) → bool
  // Test whether a node kind is a subkind of another kind.
  subKind(sub, sup) {
    for (;;) {
      if (sub == sup) return true
      sub = this.kinds[sub]
      if (!sub) return false
    }
  }
}

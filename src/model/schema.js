import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {copyObj} from "../util/obj"

import {ProseMirrorError} from "../util/error"

// ;; The exception type used to signal schema-related
// errors.
export class SchemaError extends ProseMirrorError {}

// ;; The [node](#NodeType) and [mark](#MarkType) types
// that make up a schema have several things in common—they support
// attributes, and you can [register](#SchemaItem.register) values
// with them. This class implements this functionality, and acts as a
// superclass to those `NodeType` and `MarkType`.
class SchemaItem {
  // :: Object<Attribute>
  // The set of attributes to associate with each node or mark of this
  // type.
  get attrs() { return {} }

  // :: (Object<?Attribute>)
  // Add or remove attributes from this type. Expects an object
  // mapping names to either attributes (to add) or null (to remove
  // the attribute by that name).
  static updateAttrs(attrs) {
    Object.defineProperty(this.prototype, "attrs", {value: overlayObj(this.prototype.attrs, attrs)})
  }

  // For node types where all attrs have a default value (or which don't
  // have any attributes), build up a single reusable default attribute
  // object, and use it for all nodes that don't specify specific
  // attributes.
  getDefaultAttrs() {
    let defaults = Object.create(null)
    for (let attrName in this.attrs) {
      let attr = this.attrs[attrName]
      if (attr.default == null) return null
      defaults[attrName] = attr.default
    }
    return defaults
  }

  computeAttrs(attrs, arg) {
    let built = Object.create(null)
    for (let name in this.attrs) {
      let value = attrs && attrs[name]
      if (value == null) {
        let attr = this.attrs[name]
        if (attr.default != null)
          value = attr.default
        else if (attr.compute)
          value = attr.compute(this, arg)
        else
          SchemaError.raise("No value supplied for attribute " + name)
      }
      built[name] = value
    }
    return built
  }

  freezeAttrs() {
    let frozen = Object.create(null)
    for (let name in this.attrs) frozen[name] = this.attrs[name]
    Object.defineProperty(this, "attrs", {value: frozen})
  }

  static getRegistry() {
    if (this == SchemaItem) return null
    if (!this.prototype.hasOwnProperty("registry"))
      this.prototype.registry = Object.create(Object.getPrototypeOf(this).getRegistry())
    return this.prototype.registry
  }

  static getNamespace(name) {
    if (this == SchemaItem) return null
    let reg = this.getRegistry()
    if (!Object.prototype.hasOwnProperty.call(reg, name))
      reg[name] = Object.create(Object.getPrototypeOf(this).getNamespace(name))
    return reg[name]
  }

  // :: (string, string, *)
  // Register a value in this type's registry. Various components use
  // `Schema.registry` to query values from the marks and nodes that
  // make up the schema. The `namespace`, for example
  // [`"command"`](#commands), determines which component will see
  // this value. `name` is a name specific to this value. Its meaning
  // differs per namespace.
  //
  // Subtypes inherit the registered values from their supertypes.
  // They can override individual values by calling this method to
  // overwrite them with a new value, or with `null` to disable them.
  static register(namespace, name, value) {
    this.getNamespace(namespace)[name] = () => value
  }

  // :: (string, string, (SchemaItem) → *)
  // Register a value in this types's registry, like
  // [`register`](#SchemaItem.register), but providing a function that
  // will be called with the actual node or mark type, whose return
  // value will be treated as the effective value (or will be ignored,
  // if `null`).
  static registerComputed(namespace, name, f) {
    this.getNamespace(namespace)[name] = f
  }

  // :: (string)
  // By default, schema items inherit the
  // [registered](#SchemaItem.register) items from their superclasses.
  // Call this to disable that behavior for the given namespace.
  static cleanNamespace(namespace) {
    this.getNamespace(namespace).__proto__ = null
  }
}

// ;; Node types are objects allocated once per `Schema`
// and used to tag `Node` instances with a type. They are
// instances of sub-types of this class, and contain information about
// the node type (its name, its allowed attributes, methods for
// serializing it to various formats, information to guide
// deserialization, and so on).
export class NodeType extends SchemaItem {
  constructor(name, kind, schema) {
    super()
    // :: string
    // The name the node type has in this schema.
    this.name = name
    this.kind = kind
    // Freeze the attributes, to avoid calling a potentially expensive
    // getter all the time.
    this.freezeAttrs()
    this.defaultAttrs = this.getDefaultAttrs()
    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    this.schema = schema
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
  // Determines whether nodes of this type can be dragged. Enabling it
  // causes ProseMirror to set a `draggable` attribute on its DOM
  // representation, and to put its HTML serialization into the drag
  // event's [data
  // transfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
  // when dragged.
  get draggable() { return false }

  // :: bool
  // Controls whether this node type is locked.
  get locked() { return false }

  // :: ?string
  // The kind of nodes this node may contain. `null` means it's a
  // leaf node.
  get contains() { return null }

  // :: string
  // Controls the _kind_ of the node, which is used to determine valid
  // parent/child [relations](#NodeType.contains). Should be a single
  // name or space-separated string of kind names, where later names
  // are considered to be sub-kinds of former ones (for example
  // `"textblock paragraph"`). When you want to extend the superclass'
  // set of kinds, you can do something like
  //
  //     static get kinds() { return super.kind + " mykind" }
  static get kinds() { return "node" }

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
    return this.schema.subKind(type.kind, this.contains)
  }

  // :: (NodeType) → bool
  // Test whether the nodes that can be contained in the given node
  // type are a sub-type of the nodes that can be contained in this
  // type.
  canContainContent(type) {
    return this.schema.subKind(type.contains, this.contains)
  }

  // :: (NodeType) → ?[NodeType]
  // Find a set of intermediate node types, possibly empty, that have
  // to be inserted between this type and `other` to put a node of
  // type `other` into this type.
  findConnection(other) {
    if (this.canContainType(other)) return []

    let seen = Object.create(null)
    let active = [{from: this, via: []}]
    while (active.length) {
      let current = active.shift()
      for (let name in this.schema.nodes) {
        let type = this.schema.nodes[name]
        if (type.defaultAttrs && !(type.contains in seen) && current.from.canContainType(type)) {
          let via = current.via.concat(type)
          if (type.canContainType(other)) return via
          active.push({from: type, via: via})
          seen[type.contains] = true
        }
      }
    }
  }

  computeAttrs(attrs, content) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return super.computeAttrs(attrs, content)
  }

  // :: (?Object, ?Fragment, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  create(attrs, content, marks) {
    return new Node(this, this.computeAttrs(attrs, content), Fragment.from(content), Mark.setFrom(marks))
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
      let type = types[name]
      let kinds = type.kinds.split(" ")
      for (let i = 0; i < kinds.length; i++)
        schema.registerKind(kinds[i], i ? kinds[i - 1] : null)
      result[name] = new type(name, kinds[kinds.length - 1], schema)
    }
    for (let name in result) {
      let contains = result[name].contains
      if (contains && !(contains in schema.kinds))
        SchemaError.raise("Node type " + name + " is specified to contain non-existing kind " + contains)
    }
    if (!result.doc) SchemaError.raise("Every schema needs a 'doc' type")
    if (!result.text) SchemaError.raise("Every schema needs a 'text' type")

    return result
  }

  // :: union<bool, [string]>
  // The mark types that child nodes of this node may have. `false`
  // means no marks, `true` means any mark, and an array of strings
  // can be used to explicitly list the allowed mark types.
  get containsMarks() { return false }
}

// ;; Base type for block nodetypes.
export class Block extends NodeType {
  get contains() { return "block" }
  static get kinds() { return "block" }
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
  get contains() { return "inline" }
  get containsMarks() { return true }
  get isTextblock() { return true }
  get canBeEmpty() { return true }
}

// ;; Base type for inline node types.
export class Inline extends NodeType {
  static get kinds() { return "inline" }
  get isInline() { return true }
}

// ;; The text node type.
export class Text extends Inline {
  get selectable() { return false }
  get isText() { return true }
  static get kinds() { return super.kinds + " text" }

  create(attrs, content, marks) {
    return new TextNode(this, this.computeAttrs(attrs, content), content, marks)
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
  // **`default`**`: ?string`
  //   : The default value for this attribute, to choose when no
  //     explicit value is provided.
  //
  // **`compute`**`: ?(Fragment) → string`
  //   : A function that computes a default value for the attribute from
  //     the node's content.
  //
  // **`label`**`: ?string`
  //   : A user-readable text label associated with the attribute.
  //
  // Attributes that have no default or compute property must be
  // provided whenever a node or mark of a type that has them is
  // created.
  constructor(options = {}) {
    this.default = options.default
    this.compute = options.compute
    this.label = options.label
  }
}

// Marks

// ;; Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are tagged with type
// objects, which are instantiated once per `Schema`.
export class MarkType extends SchemaItem {
  constructor(name, rank, schema) {
    super()
    // :: string
    // The name of the mark type.
    this.name = name
    this.freezeAttrs()
    this.rank = rank
    // :: Schema
    // The schema that this mark type instance is part of.
    this.schema = schema
    let defaults = this.getDefaultAttrs()
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
    return new Mark(this, this.computeAttrs(attrs))
  }

  static getOrder(marks) {
    let sorted = []
    for (let name in marks) sorted.push({name, rank: marks[name].rank})
    sorted.sort((a, b) => a.rank - b.rank)
    let ranks = Object.create(null)
    for (let i = 0; i < sorted.length; i++) ranks[sorted[i].name] = i
    return ranks
  }

  static compile(marks, schema) {
    let order = this.getOrder(marks)
    let result = Object.create(null)
    for (let name in marks)
      result[name] = new marks[name](name, order[name], schema)
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
}

// Schema specifications are data structures that specify a schema --
// a set of node types, their names, attributes, and nesting behavior.

// ;; A schema specification is a blueprint for an actual
// `Schema`. It maps names to node and mark types, along
// with extra information, such as additional attributes and changes
// to node kinds and relations.
//
// A specification consists of an object that associates node names
// with node type constructors and another similar object associating
// mark names with mark type constructors.
export class SchemaSpec {
  // :: (?Object<NodeType>, ?Object<MarkType>)
  // Create a schema specification from scratch. The arguments map
  // node names to node type constructors and mark names to mark type
  // constructors.
  constructor(nodes, marks) {
    this.nodes = nodes || {}
    this.marks = marks || {}
  }

  // :: (?Object<?NodeType>, ?Object<?MarkType>) → SchemaSpec
  // Base a new schema spec on this one by specifying nodes and marks
  // to add or remove.
  //
  // When `nodes` is passed, it should be an object mapping type names
  // to either `null`, to delete the type of that name, or to a
  // `NodeType` subclass, to add or replace the node type of that
  // name.
  //
  // Similarly, `marks` can be an object to add, change, or remove
  // [mark types](#MarkType) in the schema.
  update(nodes, marks) {
    return new SchemaSpec(nodes ? overlayObj(this.nodes, nodes) : this.nodes,
                          marks ? overlayObj(this.marks, marks) : this.marks)
  }
}

function overlayObj(base, update) {
  let copy = copyObj(base)
  for (let name in update) {
    let value = update[name]
    if (value == null) delete copy[name]
    else copy[name] = value
  }
  return copy
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
    for (let prop in this.nodes)
      if (prop in this.marks) SchemaError.raise(prop + " can not be both a node and a mark")

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

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.
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
    return this.nodes.text.create(null, text, Mark.setFrom(marks))
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
    let type = this.marks[json._]
    let attrs = null
    for (let prop in json) if (prop != "_") {
      if (!attrs) attrs = Object.create(null)
      attrs[prop] = json[prop]
    }
    return attrs ? type.create(attrs) : type.instance
  }

  // :: (string) → NodeType
  // Get the `NodeType` associated with the given name in
  // this schema, or raise an error if it does not exist.
  nodeType(name) {
    return this.nodes[name] || SchemaError.raise("Unknown node type: " + name)
  }

  registerKind(kind, sup) {
    if (kind in this.kinds) {
      if (this.kinds[kind] == sup) return
      SchemaError.raise(`Inconsistent superkinds for kind ${kind}: ${sup} and ${this.kinds[kind]}`)
    }
    if (this.subKind(kind, sup))
      SchemaError.raise(`Conflicting kind hierarchy through ${kind} and ${sup}`)
    this.kinds[kind] = sup
  }

  // :: (string, string) → bool
  // Test whether a node kind is a sub-kind of another kind.
  subKind(sub, sup) {
    for (;;) {
      if (sub == sup) return true
      sub = this.kinds[sub]
      if (!sub) return false
    }
  }

  // :: (string, (value: *, source: union<NodeType, MarkType>, name: string), ?bool)
  // Retrieve all registered items under the given name from this
  // schema. The given function will be called with each item, the
  // element—node type or mark type—that it was associated with, and
  // that element's name in the schema.
  registry(namespace, f) {
    for (let i = 0; i < 2; i++) {
      let obj = i ? this.marks : this.nodes
      for (let tname in obj) {
        let type = obj[tname], registry = type.registry, ns = registry && registry[namespace]
        if (ns) for (let prop in ns) {
          let value = ns[prop](type)
          if (value != null) f(prop, value, type, tname)
        }
      }
    }
  }
}

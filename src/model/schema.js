import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {ContentExpr} from "./content"

import {copyObj} from "../util/obj"

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
          throw new RangeError("No value supplied for attribute " + name)
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
  constructor(name, schema) {
    super()
    // :: string
    // The name the node type has in this schema.
    this.name = name
    // Freeze the attributes, to avoid calling a potentially expensive
    // getter all the time.
    this.freezeAttrs()
    this.defaultAttrs = this.getDefaultAttrs()
    this.contentExpr = null
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

  // :: ?NodeKind
  // The kind of nodes this node may contain. `null` means it's a
  // leaf node.
  get contains() { return null }

  get group() { return null }
  get groupDefault() { return false }

  get content() { return "" }
  get isLeaf() { return this.contentExpr.isLeaf }

  // :: ?NodeKind Sets the _kind_ of the node, which is used to
  // determine valid parent/child [relations](#NodeType.contains).
  // Should only be `null` for nodes that can't be child nodes (i.e.
  // the document top node).
  get kind() { return null }

  // :: (Fragment) → bool
  // Test whether the content of the given fragment could be contained
  // in this node type.
  canContainFragment(fragment) {
    for (let i = 0; i < fragment.childCount; i++)
      if (!this.canContain(fragment.child(i))) return false
    return true
  }

  // :: (Node) → bool
  // Test whether the given node could be contained in this node type.
  canContain(node) {
    if (!this.canContainType(node.type)) return false
    for (let i = 0; i < node.marks.length; i++)
      if (!this.canContainMark(node.marks[i].type)) return false
    return true
  }

  // :: (MarkType) → bool
  // Test whether this node type can contain children with the given
  // mark type.
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
    return type.kind && type.kind.isSubKind(this.contains)
  }

  appendableTo(other) {
    return this.contentExpr.appendableTo(other.contentExpr)
  }

  containsOnly(node) { // FIXME rename?
    return this.contentExpr.containsOnly(node)
  }

  // FIXME cache
  // FIXME make this the actual findConnection
  findConnectionRestInner(target) {
    let seen = Object.create(null), active = [{type: this, via: []}]
    while (active.length) {
      let current = active.shift()
      let possible = current.type.contentExpr.possibleTypes(current.type.defaultAttrs)
      for (let i = 0; i < possible.length; i++) {
        let type = possible[i]
        if (type == target) return current.via
        if (!type.isLeaf && type.defaultAttrs && !(type.name in seen)) {
          active.push({type, via: current.via.concat(type)})
          seen[type.name] = true
        }
      }
    }
  }

  findConnectionRest(target) {
    let cache = this.schema.cached.connections, key = this.name + "-" + target.name
    if (key in cache) return cache[key]
    return cache[key] = this.findConnectionRestInner(target)
  }

  findConnectionNEW(target, attrs, builder) {
    let possible = this.contentExpr.possibleTypes(attrs, builder && builder.pos)
    if (possible.indexOf(target) > -1) return []
    for (let i = 0; i < possible.length; i++) {
      let rest = possible[i].findConnectionRest(target)
      if (rest) return [possible[i]].concat(rest)
    }
  }

  // :: (NodeType) → ?[NodeType]
  // Find a set of intermediate node types, possibly empty, that have
  // to be inserted between this type and `other` to put a node of
  // type `other` into this type.
  findConnection(other) {
    return other.kind && this.findConnectionToKind(other.kind)
  }

  findConnectionToKind(kind) {
    let cache = this.schema.cached.connections, key = this.name + "-" + kind.id
    if (key in cache) return cache[key]
    return cache[key] = this.findConnectionToKindInner(kind)
  }

  findConnectionToKindInner(kind) {
    if (kind.isSubKind(this.contains)) return []

    let seen = Object.create(null)
    let active = [{from: this, via: []}]
    while (active.length) {
      let current = active.shift()
      for (let name in this.schema.nodes) {
        let type = this.schema.nodes[name]
        if (type.contains && type.defaultAttrs && !(type.contains.id in seen) &&
            current.from.canContainType(type)) {
          let via = current.via.concat(type)
          if (kind.isSubKind(type.contains)) return via
          active.push({from: type, via: via})
          seen[type.contains.id] = true
        }
      }
    }
  }

  computeAttrs(attrs, content) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return super.computeAttrs(attrs, content)
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  create(attrs, content, marks) {
    return new Node(this, this.computeAttrs(attrs, content), Fragment.from(content), Mark.setFrom(marks))
  }

  // FIXME use declarative schema, maybe tie in with .contains
  checkContent(content, attrs) {
    return this.contentExpr.matches(attrs, content)
  }

  fixContent(content, attrs) { // FIXME replace?
    if (!content) content = Fragment.empty
    let filled = this.contentExpr.fillThreeWay(attrs, Fragment.empty, content || Fragment.empty, Fragment.empty)
    if (!filled) throw new RangeError("No default content for " + this.name)
    return filled.left.append(content).append(filled.right)
  }

  static compile(types, schema) {
    let result = Object.create(null)
    for (let name in types)
      result[name] = new types[name](name, schema)

    if (!result.doc) throw new RangeError("Every schema needs a 'doc' type")
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")

    return result
  }

  // :: union<bool, [string]>
  // The mark types that child nodes of this node may have. `false`
  // means no marks, `true` means any mark, and an array of strings
  // can be used to explicitly list the allowed mark types.
  get containsMarks() { return false }
}

// ;; Class used to represent node [kind](#NodeType.kind).
export class NodeKind {
  // :: (string, ?[NodeKind], ?[NodeKind])
  // Create a new node kind with the given set of superkinds (the new
  // kind counts as a member of each of the superkinds) and subkinds
  // (which will count as a member of this new kind). The `name` field
  // is only for debugging purposes—kind equivalens is defined by
  // identity.
  constructor(name, supers, subs) {
    this.name = name
    this.id = ++NodeKind.nextID
    this.supers = Object.create(null)
    this.supers[this.id] = this
    this.subs = subs || []

    if (supers) supers.forEach(sup => this.addSuper(sup))
    if (subs) subs.forEach(sub => this.addSub(sub))
  }

  sharedSuperKind(other) {
    if (this.isSubKind(other)) return other
    if (other.isSubKind(this)) return this
    let found
    for (let id in this.supers) {
      let shared = other.supers[id]
      if (shared && (!found || shared.isSupKind(found)))
        found = shared
    }
    return found
  }

  addSuper(sup) {
    for (let id in sup.supers) {
      this.supers[id] = sup.supers[id]
      sup.subs.push(this)
    }
  }

  addSub(sub) {
    if (this.supers[sub.id])
      throw new RangeError("Circular subkind relation")
    sub.supers[this.id] = true
    sub.subs.forEach(next => this.addSub(next))
  }

  // :: (NodeKind) → bool
  // Test whether `other` is a subkind of this kind (or the same
  // kind).
  isSubKind(other) {
    return other && (other.id in this.supers) || false
  }
}
NodeKind.nextID = 0

// :: NodeKind The node kind used for generic block nodes.
NodeKind.block = new NodeKind("block")

// :: NodeKind The node kind used for generic inline nodes.
NodeKind.inline = new NodeKind("inline")

// :: NodeKind The node kind used for text nodes. Subkind of
// `NodeKind.inline`.
NodeKind.text = new NodeKind("text", [NodeKind.inline])

// ;; Base type for block nodetypes.
export class Block extends NodeType {
  get contains() { return NodeKind.block }
  get content() { return "block+" }
  get kind() { return NodeKind.block }
  get group() { return "block" }
  get isBlock() { return true }
}

// ;; Base type for textblock node types.
export class Textblock extends Block {
  get contains() { return NodeKind.inline }
  get content() { return "inline[_]*" }
  get containsMarks() { return true }
  get isTextblock() { return true }
}

// ;; Base type for inline node types.
export class Inline extends NodeType {
  get kind() { return NodeKind.inline }
  get group() { return "inline" }
  get isInline() { return true }
}

// ;; The text node type.
export class Text extends Inline {
  get selectable() { return false }
  get isText() { return true }
  get kind() { return NodeKind.text }

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

  // :: bool
  // Whether this mark should be active when the cursor is positioned
  // at the end of the mark.
  get inclusiveRight() { return true }

  // :: (?Object) → Mark
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

  // :: ([Mark]) → ?Mark
  // Tests whether there is a mark of this type in the given set.
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (set[i].type == this) return set[i]
  }
}

// Schema specifications are data structures that specify a schema --
// a set of node types, their names, attributes, and nesting behavior.

// ;; A schema specification is a blueprint for an actual
// `Schema`. It maps names to node and mark types.
//
// A specification consists of an object that associates node names
// with node type constructors and another similar object associating
// mark names with mark type constructors.
export class SchemaSpec {
  // :: (?Object<constructor<NodeType>>, ?Object<constructor<MarkType>>)
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

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(spec.nodes, this)
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(spec.marks, this)
    for (let prop in this.nodes) {
      if (prop in this.marks) throw new RangeError(prop + " can not be both a node and a mark")
      let type = this.nodes[prop]
      type.contentExpr = ContentExpr.parse(type, type.content)
    }

    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null)
    this.cached.connections = Object.create(null)

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
      throw new RangeError("Invalid node type: " + type)
    else if (type.schema != this)
      throw new RangeError("Node type from different schema used (" + type.name + ")")

    return type.create(attrs, content, marks)
  }

  // :: (string, ?[Mark]) → Node
  // Create a text node in the schema. This method is bound to the
  // Schema. Empty text nodes are not allowed.
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
    let spec = this.marks[name]
    if (!spec) throw new RangeError("No mark named " + name)
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
    let found = this.nodes[name]
    if (!found) throw new RangeError("Unknown node type: " + name)
    return found
  }

  // :: (string, (name: string, value: *, source: union<NodeType, MarkType>, name: string))
  // Retrieve all registered items under the given name from this
  // schema. The given function will be called with the name, each item, the
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

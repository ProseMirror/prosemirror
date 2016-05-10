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

  computeAttrs(attrs) {
    let built = Object.create(null)
    for (let name in this.attrs) {
      let value = attrs && attrs[name]
      if (value == null) {
        let attr = this.attrs[name]
        if (attr.default != null)
          value = attr.default
        else if (attr.compute)
          value = attr.compute(this)
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

function overlayObj(base, update) {
  let copy = copyObj(base)
  for (let name in update) {
    let value = update[name]
    if (value == null) delete copy[name]
    else copy[name] = value
  }
  return copy
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

  get isLeaf() { return this.contentExpr.isLeaf }

  get hasRequiredAttrs() {
    for (let n in this.attrs) if (this.attrs[n].isRequired) return true
    return false
  }

  compatibleContent(other) {
    return this.contentExpr.compatible(other.contentExpr)
  }

  containsOnly(node) {
    return this.contentExpr.containsOnly(node)
  }

  findWrappingInner(target) {
    let seen = Object.create(null), active = [{type: this, via: []}]
    while (active.length) {
      let current = active.shift(), match = current.type.contentExpr.start(current.type.defaultAttrs)
      let possible = match.possibleTypes()
      for (let i = 0; i < possible.length; i++) {
        let type = possible[i]
        if (!match.matchType(type, []).validEnd()) continue
        if (type == target) return current.via
        if (!type.isLeaf && !type.hasRequiredAttrs && !(type.name in seen)) {
          active.push({type, via: current.via.concat(type)})
          seen[type.name] = true
        }
      }
    }
  }

  findWrappingCached(target) {
    let cache = this.schema.cached.wrappings, key = this.name + "-" + target.name
    if (key in cache) return cache[key]
    return cache[key] = this.findWrappingInner(target)
  }

  // :: (NodeType) → ?[NodeType]
  // Find a set of intermediate node types, possibly empty, that have
  // to be inserted between this type and `other` to put a node of
  // type `other` into this type.
  findWrapping(target, pos) {
    let possible = pos.possibleTypes()
    if (possible.indexOf(target) > -1) return []
    for (let i = 0; i < possible.length; i++) {
      let rest = possible[i].findWrappingCached(target)
      if (rest) return [possible[i]].concat(rest)
    }
  }

  computeAttrs(attrs) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return super.computeAttrs(attrs)
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  create(attrs, content, marks) {
    return new Node(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks))
  }

  validContent(content, attrs) {
    return this.contentExpr.matches(attrs, content)
  }

  fixContent(content, attrs) { // FIXME replace? optimize?
    if (content)
      content = this.contentExpr.start(attrs).fillBefore(content).append(content)
    else
      content = Fragment.empty
    return content.append(this.contentExpr.getMatchAt(attrs, content).fillBefore(Fragment.empty, true))
  }

  static compile(nodes, schema) {
    let result = Object.create(null)
    for (let name in nodes)
      result[name] = new nodes[name].type(name, schema)

    if (!result.doc) throw new RangeError("Every schema needs a 'doc' type")
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")

    return result
  }
}

// ;; Base type for block nodetypes.
export class Block extends NodeType {
  get isBlock() { return true }
}

// ;; Base type for textblock node types.
export class Textblock extends Block {
  get isTextblock() { return true }
}

// ;; Base type for inline node types.
export class Inline extends NodeType {
  get isInline() { return true }
}

// ;; The text node type.
export class Text extends Inline {
  get selectable() { return false }
  get isText() { return true }

  create(attrs, content, marks) {
    return new TextNode(this, this.computeAttrs(attrs), content, marks)
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

  get isRequired() {
    return !this.default && !this.compute
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

// ;; #path=SchemaSpec #kind=interface
// An object describing a schema, as passed to the `Schema`
// constructor.

// :: Object<{type: constructor<NodeType>, content: ?string}> #path=SchemaSpec.nodes
// The node types in this schema. Maps names to `NodeType` subclasses,
// along with an optional content string, as parsed by
// `ContentExpr.parse`.

// :: ?Object<[string]> #path=SchemaSpec.groups
// Specifies the node groups that are used in the schema's content
// expressions.

// :: ?Object<constructor<MarkType>> #path=SchemaSpec.marks
// The mark types that exist in this schema.

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).
export class Schema {
  // :: (SchemaSpec)
  // Construct a schema from a specification.
  constructor(spec) {
    // :: SchemaSpec The spec that the schema is based on.
    this.spec = spec
    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(spec.nodes, this)
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(spec.marks || {}, this)
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + " can not be both a node and a mark")
      let type = this.nodes[prop]
      type.contentExpr = ContentExpr.parse(type, spec.nodes[prop].content || "",
                                           spec.groups || Object.create(null))
    }

    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null)
    this.cached.wrappings = Object.create(null)

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

import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {ContentExpr} from "./content"

import {copyObj} from "../util/obj"
import {OrderedMap} from "../util/orderedmap"

// ;; The [node](#NodeType) and [mark](#MarkType) types
// that make up a schema have several things in common—they support
// attributes. This class implements this functionality, and acts as a
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
      if (attr.default === undefined) return null
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
        if (attr.default !== undefined)
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

  // :: bool
  // True for node types that allow no content.
  get isLeaf() { return this.contentExpr.isLeaf }

  hasRequiredAttrs(ignore) {
    for (let n in this.attrs)
      if (this.attrs[n].isRequired && (!ignore || !(n in ignore))) return true
    return false
  }

  compatibleContent(other) {
    return this == other || this.contentExpr.compatible(other.contentExpr)
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

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Like [`create`](NodeType.create), but check the given content
  // against the node type's content restrictions, and throw an error
  // if it doesn't match.
  createChecked(attrs, content, marks) {
    attrs = this.computeAttrs(attrs)
    content = Fragment.from(content)
    if (!this.validContent(content, attrs))
      throw new RangeError("Invalid content for node " + this.name)
    return new Node(this, attrs, content, Mark.setFrom(marks))
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → ?Node
  // Like [`create`](NodeType.create), but see if it is necessary to
  // add nodes to the start or end of the given fragment to make it
  // fit the node. If no fitting wrapping can be found, return null.
  // Note that, due to the fact that required nodes can always be
  // created, this will always succeed if you pass null or
  // `Fragment.empty` as content.
  createAndFill(attrs, content, marks) {
    attrs = this.computeAttrs(attrs)
    content = Fragment.from(content)
    if (content.size) {
      let before = this.contentExpr.start(attrs).fillBefore(content)
      if (!before) return null
      content = before.append(content)
    }
    let after = this.contentExpr.getMatchAt(attrs, content).fillBefore(Fragment.empty, true)
    if (!after) return null
    return new Node(this, attrs, content.append(after), Mark.setFrom(marks))
  }

  // :: (Fragment, ?Object) → bool
  // Returns true if the given fragment is valid content for this node
  // type.
  validContent(content, attrs) {
    return this.contentExpr.matches(attrs, content)
  }

  static compile(nodes, schema) {
    let result = Object.create(null)
    nodes.forEach((name, spec) => result[name] = new spec.type(name, schema))

    if (!result.doc) throw new RangeError("Every schema needs a 'doc' type")
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")

    return result
  }
}

// ;; Base type for block nodetypes.
export class Block extends NodeType {
  get isBlock() { return true }
  get isTextblock() { return this.contentExpr.inlineContent }
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
  toDOM(node) { return node.text }
}

// Attribute descriptors

// ;; Attributes are named values associated with nodes and marks.
// Each node type or mark type has a fixed set of attributes, which
// instances of this class are used to control. Attribute values must
// be JSON-serializable.
export class Attribute {
  // :: (Object)
  // Create an attribute. `options` is an object containing the
  // settings for the attributes. The following settings are
  // supported:
  //
  // **`default`**`: ?any`
  //   : The default value for this attribute, to choose when no
  //     explicit value is provided.
  //
  // **`compute`**`: ?(Fragment) → any`
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
    return this.default === undefined && !this.compute
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

  static compile(marks, schema) {
    let result = Object.create(null), rank = 0
    marks.forEach((name, markType) => result[name] = new markType(name, rank++, schema))
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

// :: union<Object<NodeSpec>, OrderedMap<NodeSpec>> #path=SchemaSpec.nodes
// The node types in this schema. Maps names to `NodeSpec` objects
// describing the node to be associated with that name. Their order is significant

// :: ?union<Object<constructor<MarkType>>, OrderedMap<constructor<MarkType>>> #path=SchemaSpec.marks
// The mark types that exist in this schema.

// ;; #path=NodeSpec #kind=interface

// :: constructor<NodeType> #path=NodeSpec.type
// The `NodeType` class to be used for this node.

// :: ?string #path=NodeSpec.content
// The content expression for this node, as parsed by
// `ContentExpr.parse`. When not given, the node does not allow any
// content.

// :: ?string #path=NodeSpec.group
// The group or space-separated groups to which this node belongs, as
// referred to in the content expressions for the schema.

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).
export class Schema {
  // :: (SchemaSpec)
  // Construct a schema from a specification.
  constructor(spec) {
    // :: OrderedMap<NodeSpec> The node specs that the schema is based on.
    this.nodeSpec = OrderedMap.from(spec.nodes)
    // :: OrderedMap<constructor<MarkType>> The mark spec that the schema is based on.
    this.markSpec = OrderedMap.from(spec.marks)

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(this.nodeSpec, this)
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(this.markSpec, this)
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + " can not be both a node and a mark")
      let type = this.nodes[prop]
      type.contentExpr = ContentExpr.parse(type, this.nodeSpec.get(prop).content || "", this.nodeSpec)
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

    return type.createChecked(attrs, content, marks)
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
}

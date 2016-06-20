const {Node, TextNode} = require("./node")
const {Fragment} = require("./fragment")
const {Mark} = require("./mark")
const {ContentExpr} = require("./content")
const {parseDOM} = require("./from_dom")

const {copyObj} = require("../util/obj")
const {OrderedMap} = require("../util/orderedmap")

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function defaultAttrs(attrs) {
  let defaults = Object.create(null)
  for (let attrName in attrs) {
    let attr = attrs[attrName]
    if (attr.default === undefined) return null
    defaults[attrName] = attr.default
  }
  return defaults
}

function computeAttrs(attrs, value) {
  let built = Object.create(null)
  for (let name in attrs) {
    let given = value && value[name]
    if (given == null) {
      let attr = attrs[name]
      if (attr.default !== undefined)
        given = attr.default
      else if (attr.compute)
        given = attr.compute()
      else
        throw new RangeError("No value supplied for attribute " + name)
    }
    built[name] = given
  }
  return built
}

// ;; Node types are objects allocated once per `Schema`
// and used to tag `Node` instances with a type. They are
// instances of sub-types of this class, and contain information about
// the node type (its name, its allowed attributes, methods for
// serializing it to various formats, information to guide
// deserialization, and so on).
class NodeType {
  constructor(name, schema) {
    // :: string
    // The name the node type has in this schema.
    this.name = name
    // Freeze the attributes, to avoid calling a potentially expensive
    // getter all the time.
    Object.defineProperty(this, "attrs", {value: copyObj(this.attrs)})
    this.defaultAttrs = defaultAttrs(this.attrs)
    this.contentExpr = null
    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    this.schema = schema
  }

  // :: Object<Attribute> #path=NodeType.prototype.attrs
  // The attributes for this node type.

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
  // True for node types that allow no content.
  get isLeaf() { return this.contentExpr.isLeaf }

  // :: bool
  // Controls whether nodes of this type can be selected (as a [node
  // selection](#NodeSelection)).
  get selectable() { return true }

  // :: bool
  // Determines whether nodes of this type can be dragged. Enabling it
  // causes ProseMirror to set a `draggable` attribute on its DOM
  // representation, and to put its HTML serialization into the drag
  // event's [data
  // transfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
  // when dragged.
  get draggable() { return false }

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
    else return computeAttrs(this.attrs, attrs)
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
  // Like [`create`](#NodeType.create), but check the given content
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
  // Like [`create`](#NodeType.create), but see if it is necessary to
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
  // type with the given attributes.
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

  // :: (Node) → DOMOutputSpec
  // Defines the way a node of this type should be serialized to
  // DOM/HTML. Should return an [array structure](#DOMOutputSpec) that
  // describes the resulting DOM structure, with an optional number
  // zero (“hole”) in it to indicate where the node's content should
  // be inserted.
  toDOM(_) { throw new Error("Failed to override NodeType.toDOM") }

  // :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>>
  // Defines the way nodes of this type are parsed. Should, if
  // present, contain an object mapping CSS selectors (such as `"p"`
  // for `<p>` tags, or `"div[data-type=foo]"` for `<div>` tags with a
  // specific attribute) to [parse specs](#ParseSpec) or functions
  // that, when given a DOM node, return either `false` or a parse
  // spec.
  get matchDOMTag() {}
}
exports.NodeType = NodeType

// ;; Base type for block nodetypes.
class Block extends NodeType {
  get isBlock() { return true }
  get isTextblock() { return this.contentExpr.inlineContent }
}
exports.Block = Block

// ;; Base type for inline node types.
class Inline extends NodeType {
  get isInline() { return true }
}
exports.Inline = Inline

// ;; The text node type.
class Text extends Inline {
  get selectable() { return false }
  get isText() { return true }

  create(attrs, content, marks) {
    return new TextNode(this, this.computeAttrs(attrs), content, marks)
  }
  toDOM(node) { return node.text }
}
exports.Text = Text

// Attribute descriptors

// ;; Attributes are named values associated with nodes and marks.
// Each node type or mark type has a fixed set of attributes, which
// instances of this class are used to control. Attribute values must
// be JSON-serializable.
class Attribute {
  // :: (Object)
  // Create an attribute. `options` is an object containing the
  // settings for the attributes. The following settings are
  // supported:
  //
  // **`default`**`: ?any`
  //   : The default value for this attribute, to choose when no
  //     explicit value is provided.
  //
  // **`compute`**`: ?() → any`
  //   : A function that computes a default value for the attribute.
  //
  // Attributes that have no default or compute property must be
  // provided whenever a node or mark of a type that has them is
  // created.
  constructor(options = {}) {
    this.default = options.default
    this.compute = options.compute
  }

  get isRequired() {
    return this.default === undefined && !this.compute
  }
}
exports.Attribute = Attribute

// Marks

// ;; Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are tagged with type
// objects, which are instantiated once per `Schema`.
class MarkType {
  constructor(name, rank, schema) {
    // :: string
    // The name of the mark type.
    this.name = name
    Object.defineProperty(this, "attrs", {value: copyObj(this.attrs)})
    this.rank = rank
    // :: Schema
    // The schema that this mark type instance is part of.
    this.schema = schema
    let defaults = defaultAttrs(this.attrs)
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
    return new Mark(this, computeAttrs(this.attrs, attrs))
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

  // :: (mark: Mark) → DOMOutputSpec
  // Defines the way marks of this type should be serialized to DOM/HTML.
  toDOM(_) { throw new Error("Failed to override MarkType.toDOM") }

  // :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>>
  // Defines the way marks of this type are parsed. Works just like
  // `NodeType.matchTag`, but produces marks rather than nodes.
  get matchDOMTag() {}

  // :: Object<union<?Object, (string) → union<bool, ?Object>>>
  // Defines the way DOM styles are mapped to marks of this type. Should
  // contain an object mapping CSS property names, as found in inline
  // styles, to either attributes for this mark (null for default
  // attributes), or a function mapping the style's value to either a
  // set of attributes or `false` to indicate that the style does not
  // match.
  get matchDOMStyle() {}
}
exports.MarkType = MarkType

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
// The content expression for this node, as described in the [schema
// guide](guide/schema.html). When not given, the node does not allow
// any content.

// :: ?string #path=NodeSpec.group
// The group or space-separated groups to which this node belongs, as
// referred to in the content expressions for the schema.

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).
class Schema {
  // :: (SchemaSpec, ?any)
  // Construct a schema from a specification.
  constructor(spec, data) {
    // :: OrderedMap<NodeSpec> The node specs that the schema is based on.
    this.nodeSpec = OrderedMap.from(spec.nodes)
    // :: OrderedMap<constructor<MarkType>> The mark spec that the schema is based on.
    this.markSpec = OrderedMap.from(spec.marks)

    // :: any A generic field that you can use (by passing a value to
    // the constructor) to store arbitrary data or references in your
    // schema object, for use by node- or mark- methods.
    this.data = data

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

  // :: (DOMNode, ?Object) → Node
  // Parse a document from the content of a DOM node. To provide an
  // explicit parent document (for example, when not in a browser
  // window environment, where we simply use the global document),
  // pass it as the `document` property of `options`.
  parseDOM(dom, options = {}) {
    return parseDOM(this, dom, options)
  }
}
exports.Schema = Schema

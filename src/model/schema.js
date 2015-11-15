import {BlockNode, TextblockNode, InlineNode, TextNode} from "./node"
import {StyleMarker} from "./style"

import {ProseMirrorError} from "../util/error"

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

export class NodeType {
  constructor(name, contains, attrs, schema) {
    this.name = name
    this.contains = contains
    this.attrs = attrs
    this.schema = schema
    this.defaultAttrs = null
  }

  get locked() { return false }
  get isTextblock() { return false }

  get selectable() { return true }

  static get kind() { return "." }

  canContain(node) {
    return this.canContainType(node.type)
  }

  canContainType(type) {
    return this.schema.subKind(type.name, this.contains)
  }

  canContainChildren(node, liberal) {
    if (!liberal && !this.schema.subKind(node.type.contains, this.contains)) return false
    for (let i = 0; i < node.length; i++)
      if (!this.canContain(node.child(i))) return false
    return true
  }

  findConnection(other) {
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

  create(attrs, content, styles) {
    return new this.instance(this, this.buildAttrs(attrs, content), content, styles)
  }

  createAutoFill(attrs, content, styles) {
    if ((!content || content.length == 0) && !this.canBeEmpty)
      content = this.defaultContent()
    return this.create(attrs, content, styles)
  }

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

  static register(prop, value) {
    ;(this.prototype[prop] || (this.prototype[prop] = [])).push(value)
  }
}
NodeType.attributes = {}

export class Block extends NodeType {
  get instance() { return BlockNode }
  static get contains() { return "block" }
  static get kind() { return "block." }
  get isBlock() { return true }

  get canBeEmpty() { return this.contains == null }

  defaultContent() {
    let inner = this.schema.defaultTextblockType().create()
    let conn = this.findConnection(inner.type)
    if (!conn) SchemaError.raise("Can't create default content for " + this.name)
    for (let i = conn.length - 1; i >= 0; i--) inner = conn[i].create(null, [inner])
    return [inner]
  }
}

export class Textblock extends Block {
  get instance() { return TextblockNode }
  static get contains() { return "inline" }
  get containsStyles() { return true }
  get isTextblock() { return true }

  canContain(node) {
    return super.canContain(node) && node.styles.every(s => this.canContainStyle(s))
  }

  canContainStyle(type) {
    let contains = this.containsStyles
    if (contains === true) return true
    if (contains) for (let i = 0; i < contains.length; i++)
      if (contains[i] == type.name) return true
    return false
  }

  get canBeEmpty() { return true }
}

export class Inline extends NodeType {
  get instance() { return InlineNode }
  static get contains() { return null }
  static get kind() { return "inline." }
}

export class Text extends Inline {
  get instance() { return TextNode }
  get selectable() { return false }
}

// Attribute descriptors

export class Attribute {
  constructor(options = {}) {
    this.default = options.default
    this.compute = options.compute
  }
}

// Styles

export class StyleType {
  constructor(name, attrs, rank, schema) {
    this.name = name
    this.attrs = attrs
    this.rank = rank
    this.schema = schema
    let defaults = getDefaultAttrs(this.attrs)
    this.instance = defaults && new StyleMarker(this, defaults)
  }

  static get rank() { return 50 }

  create(attrs) {
    if (!attrs && this.instance) return this.instance
    return new StyleMarker(this, buildAttrs(this.attrs, attrs, this))
  }

  static getOrder(styles) {
    let sorted = []
    for (let name in styles) sorted.push({name, rank: styles[name].type.rank})
    sorted.sort((a, b) => a.rank - b.rank)
    let ranks = Object.create(null)
    for (let i = 0; i < sorted.length; i++) ranks[sorted[i].name] = i
    return ranks
  }

  static compile(styles, schema) {
    let order = this.getOrder(styles)
    let result = Object.create(null)
    for (let name in styles) {
      let info = styles[name]
      let attrs = info.attributes || info.type.attributes
      result[name] = new info.type(name, attrs, order[name], schema)
    }
    return result
  }

  static register(prop, value) {
    ;(this.prototype[prop] || (this.prototype[prop] = [])).push(value)
  }
}
StyleType.attributes = {}

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

export class SchemaSpec {
  constructor(nodes, styles) {
    this.nodes = nodes ? copyObj(nodes, ensureWrapped) : Object.create(null)
    this.styles = styles ? copyObj(styles, ensureWrapped) : Object.create(null)
  }

  updateNodes(nodes) {
    return new SchemaSpec(overlayObj(this.nodes, nodes), this.styles)
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
    return new SchemaSpec(copy, this.styles)
  }

  updateStyles(styles) {
    return new SchemaSpec(this.nodes, overlayObj(this.styles, styles))
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

/**
 * Document schema class.
 */
export class Schema {
  constructor(spec, styles) {
    if (!(spec instanceof SchemaSpec)) spec = new SchemaSpec(spec, styles)
    this.spec = spec
    this.kinds = Object.create(null)
    this.nodes = NodeType.compile(spec.nodes, this)
    this.styles = StyleType.compile(spec.styles, this)
    this.cached = Object.create(null)

    this.node = this.node.bind(this)
    this.text = this.text.bind(this)
    this.nodeFromJSON = this.nodeFromJSON.bind(this)
    this.styleFromJSON = this.styleFromJSON.bind(this)
  }

  node(type, attrs, content, styles) {
    if (typeof type == "string")
      type = this.nodeType(type)
    else if (!(type instanceof NodeType))
      SchemaError.raise("Invalid node type: " + type)
    else if (type.schema != this)
      SchemaError.raise("Node type from different schema used (" + type.name + ")")

    return type.create(attrs, content, styles)
  }

  text(text, styles) {
    return this.nodes.text.create(null, text, styles)
  }

  defaultTextblockType() {
    let cached = this.cached.defaultTextblockType
    if (cached !== undefined) return cached
    for (let name in this.nodes) {
      if (this.nodes[name].defaultTextblock)
        return this.cached.defaultTextblockType = this.nodes[name]
    }
    return this.cached.defaultTextblockType = null
  }

  style(name, attrs) {
    let spec = this.styles[name] || SchemaError.raise("No style named " + name)
    return spec.create(attrs)
  }

  nodeFromJSON(json) {
    let type = this.nodeType(json.type)
    return type.create(json.attrs,
                       json.text || (json.content && json.content.map(this.nodeFromJSON)),
                       json.styles && json.styles.map(this.styleFromJSON))
  }

  styleFromJSON(json) {
    if (typeof json == "string") return this.style(json)
    return this.style(json._, json)
  }

  nodeType(name) {
    return this.nodes[name] || SchemaError.raise("Unknown node type: " + name)
  }

  subKind(sub, sup) {
    for (;;) {
      if (sub == sup) return true
      sub = this.kinds[sub]
      if (!sub) return false
    }
  }
}

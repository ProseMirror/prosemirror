import {BlockNode, TextblockNode, InlineNode, TextNode} from "./node"
import {StyleMarker} from "./style"

import {ProseMirrorError} from "../util/error"

export class SchemaError extends ProseMirrorError {}

export class NodeType {
  constructor(name, contains, categories, attrs, schema) {
    this.name = name
    this.contains = contains
    this.categories = categories
    this.attrs = attrs
    this.schema = schema
    this.defaultAttrs = null
  }

  get plainText() { return false }
  get configurable() { return true }
  get textblock() { return false }

  canContain(type) {
    return type.categories.indexOf(this.contains) > -1
  }

  findConnection(other) {
    if (this.canContain(other)) return []

    let seen = Object.create(null)
    let active = [{from: this, via: []}]
    while (active.length) {
      let current = active.shift()
      for (let name in this.schema.nodes) {
        let type = this.schema.nodeType(name)
        if (!(type.contains in seen) && current.from.canContain(type)) {
          let via = current.via.concat(type)
          if (type.canContain(other)) return via
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

  static compile(types, schema) {
    let result = Object.create(null)
    let categoriesSeen = Object.create(null)
    for (let name in types) {
      let info = types[name]
      let type = info.type || SchemaError.raise("Missing node type for " + name)
      let categories = (info.category || type.category).split(" ")
      categories.forEach(n => categoriesSeen[n] = true)
      let contains = "contains" in info ? info.contains : type.contains
      result[name] = new type(name, contains, categories,
                              info.attributes || type.attributes,
                              schema)
    }
    for (let name in result) {
      let contains = result[name].contains
      if (contains && !(contains in categoriesSeen))
        SchemaError.raise("Node type " + name + " is specified to contain non-existing category " + contains)
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
  static get category() { return "block" }
}

export class Textblock extends Block {
  get instance() { return TextblockNode }
  static get contains() { return "inline" }
  get textblock() { return true }
}

export class Inline extends NodeType {
  get instance() { return InlineNode }
  static get contains() { return null }
  static get category() { return "inline" }
}

export class Text extends Inline {
  get instance() { return TextNode }
}

// Attribute descriptors

export class Attribute {
  constructor(deflt, compute) {
    this.default = deflt
    this.compute = compute
  }
}

// Styles

export class StyleType {
  constructor(name, attrs, rank) {
    this.name = name
    this.attrs = attrs
    this.rank = rank
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

  static compile(styles) {
    let order = this.getOrder(styles)
    let result = Object.create(null)
    for (let name in styles) {
      let info = styles[name]
      let attrs = info.attributes || info.type.attributes
      result[name] = new info.type(name, attrs, order[name])
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
    this.nodes = copyObj(nodes, ensureWrapped)
    this.styles = copyObj(styles, ensureWrapped)
  }

  updateNodes(nodes) {
    return new SchemaSpec(overlayObj(this.nodes, nodes), this.styles)
  }

  updateStyles(styles) {
    return new SchemaSpec(this.nodes, overlayObj(this.styles, styles))
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
  constructor(spec) {
    this.spec = spec
    this.nodes = NodeType.compile(spec.nodes, this)
    this.styles = StyleType.compile(spec.styles)
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
}

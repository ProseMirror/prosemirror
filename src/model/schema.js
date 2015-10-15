import {BlockNode, TextblockNode, InlineNode, TextNode} from "./node"

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
      for (let name in this.schema.nodeTypes) {
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
  constructor(deflt) {
    this.default = deflt
  }
}

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

export class SchemaSpec {
  constructor(nodeTypes, styles) {
    this.nodeTypes = copyObj(nodeTypes, ensureWrapped)
    this.styles = styles
  }

  updateNodes(nodes) {
    let copy = copyObj(this.nodeTypes)
    for (let name in nodes) {
      let info = ensureWrapped(nodes[name])
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
    return new SchemaSpec(copy, this.styles)
  }

  addAttribute(filter, attrName, attrInfo) {
    let copy = copyObj(this.nodeTypes)
    for (let name in copy) {
      if (typeof filter == "string" ? filter == name : filter(name, copy[name])) {
        let info = copy[name] = copyObj(copy[name])
        if (!info.attributes) info.attributes = copyObj(info.type.attributes)
        info.attributes[attrName] = attrInfo
      }
    }
  }

  updateStyles(styles) {
    let copy = copyObj(styles)
    for (let name in this.styles) {
      let info = styles[name]
      if (info == null) delete copy[name]
      else copy[name] = info
    }
    return new SchemaSpec(this.nodeTypes, copy)
  }
}

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function buildDefaultAttrs(nodeTypes) {
  nodeLoop: for (let name in nodeTypes) {
    let type = nodeTypes[name]
    let attrs = type.attrs, defaults = Object.create(null)
    for (let attrName in attrs) {
      let attr = attrs[attrName]
      if (attr.default == null) continue nodeLoop
      defaults[attrName] = attr.default
    }
    type.defaultAttrs = defaults
  }
}

function compileNodeTypes(types, schema) {
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
  buildDefaultAttrs(result)
  return result
}

export class Schema {
  constructor(spec) {
    this.spec = spec
    this.nodeTypes = compileNodeTypes(spec.nodeTypes, this)
    this.styles = spec.styles // FIXME
    this.cached = Object.create(null)
    this.node = this.node.bind(this)
    this.text = this.text.bind(this)
    this.nodeFromJSON = this.nodeFromJSON.bind(this)
  }

  buildAttrs(type, attrs) {
    if (!attrs && type.defaultAttrs) return type.defaultAttrs

    let built = Object.create(null)
    for (let name in type.attrs) {
      let value = attrs && attrs[name]
      if (value == null) {
        value = type.attrs[name].default
        if (value == null)
          SchemaError.raise("No value supplied for attribute " + name + " on node " + type.name)
      }
      built[name] = value
    }
    return built
  }

  node(type, attrs, content, styles) {
    if (typeof type == "string")
      type = this.nodeType(type)
    else if (!(type instanceof NodeType))
      SchemaError.raise("Invalid node type: " + type)
    else if (type.schema != this)
      SchemaError.raise("Node type from different schema used (" + type.name + ")")

    return new type.instance(type, this.buildAttrs(type, attrs), content, styles)
  }

  text(text, styles) {
    return new TextNode(this.nodeTypes.text, this.buildAttrs(this.nodeTypes.text), text, styles)
  }

  nodeFromJSON(json) {
    let type = this.nodeType(json.type)
    return new type.instance(type, this.buildAttrs(type, json.attrs),
                             json.text || (json.content && json.content.map(this.nodeFromJSON)),
                             json.styles)
  }

  nodeType(name) {
    return this.nodeTypes[name] || SchemaError.raise("Unknown node type: " + name)
  }
}

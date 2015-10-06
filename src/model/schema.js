import {BlockNode, TextblockNode, InlineNode, TextNode} from "./node"

import {ProseMirrorError} from "../util/error"

export class SchemaError extends ProseMirrorError {}

const nodeKinds = {
  __proto__: null,
  block: {
    constructor: BlockNode,
    category: "block",
    configurableCategory: true,
    contains: "block",
    configurableContains: true
  },
  textblock: {
    constructor: TextblockNode,
    category: "block",
    configurableCategory: true,
    contains: "inline",
    configurableContains: false
  },
  inline: {
    constructor: InlineNode,
    category: "inline",
    configurableCategory: false,
    contains: null,
    configurableContains: false
  },
  text: {
    constructor: TextNode,
    category: "inline",
    configurableCategory: false,
    contains: null,
    configurableContains: false
  }
}

function copyObj(obj) {
  let result = Object.create(null)
  for (let prop in obj) result[prop] = obj[prop]
  return result
}

export class Schema {
  constructor(nodeTypes, styles, data) {
    this.nodeTypes = nodeTypes
    this.styles = styles
    this.data = data
    this.compiled = null
  }

  updateNodes(nodes) {
    let copy = copyObj(this.nodeTypes)
    for (let name in nodes) {
      let info = nodes[name]
      if (info == null) {
        delete copy[name]
      } else if (info.kind) {
        copy[name] = info
      } else {
        let existing = copy[name] = copyObj(copy[name])
        for (let prop in info)
          existing[prop] = info[prop]
      }
    }
    return new Schema(copy, this.styles, this.data)
  }

  renameNode(oldName, newName) {
    let copy = copyObj(this.nodeTypes)
    if (copy.hasOwnProperty(oldName)) {
      copy[newName] = copy[oldName]
      delete copy[oldName]
    }
    function renameInCategory(cat) {
      if (!cat) return null
      let arr = cat.split(" "), found
      if ((found = arr.indexOf(oldName)) == -1) return null
      arr[found] = newName
      return arr.join(" ")
    }
    for (let name in copy) {
      let info = copy[name], newCat = renameInCategory(info.category)
      if (info.contains == oldName || newCat) {
        info = copy[name] = copyObj(info)
        if (info.contains == oldName) info.contains = newName
        if (newCat) info.category = newCat
      }
    }
    return new Schema(copy, this.styles, this.data)
  }

  addAttribute(filter, attrName, attrInfo) {
    let copy = copyObj(this.nodeTypes)
    for (let name in copy) {
      if (typeof filter == "string" ? filter == name : filter(name, copy[name])) {
        let info = copy[name] = copyObj(copy[name])
        if (!info.attributes) info.attributes = {}
        info.attributes[attrName] = attrInfo
      }
    }
  }

  updateStyles(styles) {
    let copy = copyObj(this.styles)
    for (let name in nodes) {
      let info = nodes[name]
      if (info == null) delete copy[name]
      else copy[name] = info
    }
    return new Schema(this.nodeTypes, copy, this.data)
  }

  compile() {
    return this.compiled || (this.compiled = new CompiledSchema(this))
  }
}

class NodeType {
  constructor(name, ctor, categories, contains, attrs, plainText, configurable, schema) {
    this.name = name
    this.ctor = ctor
    this.categories = categories
    this.contains = contains
    // FIXME make a reusable default attrs obj if all attrs have a default value
    this.attrs = attrs
    this.plainText = plainText
    this.configurable = configurable
    this.schema = schema
  }

  get textblock() { return this.ctor == TextblockNode }

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
        let type = this.schema.nodeTypes[name]
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

function compileNodeTypes(types, schema) {
  let result = Object.create(null)
  let categoriesSeen = Object.create(null)
  for (let name in types) {
    let info = types[name]
    let kind = nodeKinds[info.kind] || SchemaError.raise("Unsupported node type: " + info.kind)
    if (info.category && info.category != kind.category && !kind.configurableCategory)
      SchemaError.raise("Nodes of kind " + info.kind + " must have category " + kind.category)
    let categories = info.category ? info.category.split(" ") : [kind.category]
    categories.forEach(n => categoriesSeen[n] = true)
    if ("contains" in info && info.contains != kind.contains && !kind.configurableContains)
      SchemaError.raise("Nodes of kind " + info.kind + " must contain " + kind.contains)
    let contains = "contains" in info ? info.contains : kind.contains
    result[name] = new NodeType(name, kind.constructor, categories, contains,
                                info.attributes || nullAttrs, // FIXME
                                info.plainText === true,
                                info.configurable === false,
                                schema)
  }
  for (let name in result) {
    let contains = result[name].contains
    if (contains && !(contains in categoriesSeen) && !(contains in result))
      SchemaError.raise("Node type " + name + " is specified to contain non-existing category " + contains)
  }
  if (!result.doc) SchemaError.raise("Every schema needs a 'doc' type")
  if (!result.text) SchemaError.raise("Every schema needs a 'text' type")
  return result
}

class CompiledSchema {
  constructor(schema) {
    this.nodeTypes = compileNodeTypes(schema.nodeTypes, this)
    this.styles = schema.styles // FIXME
    this.data = schema.data
  }

  buildAttrs(type, attrs) {
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

  // FIXME provide variant that doesn't check/fill in type and attrs?
  mk(type, attrs, content, styles) {
    if (typeof type == "string") {
      let found = this.nodeTypes[type]
      if (!found) SchemaError.raise("Unknown node type: " + type)
      type = found
    } else if (!(type instanceof NodeType)) {
      SchemaError.raise("Invalid node type: " + type)
    } else if (type.schema != this) {
      SchemaError.raise("Node type from different schema used (" + type.name + ")")
    }

    return new type.ctor(type, this.buildAttrs(type, attrs), content, styles)
  }

  text(text, styles) {
    return new TextNode(this.nodeTypes.text, this.buildAttrs(this.nodeTypes.text), text, styles)
  }

  mkFromJSON(json) {
    let type = this.nodeTypes[json.type]
    if (!type) SchemaError.raise("Unknown node type: " + json.type)
    return new type.ctor(type, this.buildAttrs(type, maybeNull(json.attrs)),
                         json.text || (json.content && json.content.map(e => this.mkFromJSON(e))),
                         json.styles)
  }
}

const nullAttrs = {}

function maybeNull(obj) {
  if (!obj) return nullAttrs
  for (let _prop in obj) return obj
  return nullAttrs
}

export const baseSchema = new Schema({
  doc: {
    kind: "block",
  },
  paragraph: {
    kind: "textblock"
  },
  text: {
    kind: "text"
  }
}, {
  code: {},
  em: {},
  strong: {},
  link: {
    attributes: {
      href: {},
      title: {default: ""}
    }
  }
}, {})

const defaultSchema = baseSchema.updateNodes({
  blockquote: {
    kind: "block"
  },
  ordered_list: {
    kind: "block",
    contains: "list_item",
    attributes: {
      order: {default: "1"}
    }
  },
  bullet_list: {
    kind: "block",
    contains: "list_item"
  },
  list_item: {
    kind: "block",
    category: "list_item"
  },
  horizontal_rule: {
    kind: "block",
    contains: null
  },

  heading: {
    kind: "textblock",
    attributes: {
      level: {default: "1"}
    }
  },
  code_block: {
    kind: "textblock",
    attributes: {
      params: {default: ""}
    },
    plainText: true
  },

  image: {
    kind: "inline",
    attributes: {
      src: {},
      title: {default: ""},
      alt: {default: ""}
    }
  },
  hard_break: {
    kind: "inline"
  }
})

export const nodeTypes = defaultSchema.compile().nodeTypes // FIXME


export function $node(type, attrs, content, styles) {
  return defaultSchema.compile().mk(type, attrs, content, styles)
}

export function $text(text, styles) {
  return defaultSchema.compile().text(text, styles)
}

export function $fromJSON(json) {
  return defaultSchema.compile().mkFromJSON(json)
}

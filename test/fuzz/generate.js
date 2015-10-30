import {defaultSchema as schema} from "../../src/model"

import {text} from "./tao"

export const attrs = {
  image: {src: "http://image", alt: "my image"},
  html_block: {html: "<block>foo</block>"},
  html_tag: {html: "<span>tag</span>"},
  heading: {level: 1}
}

export function createNode(type, fuel) {
  let node = schema.node(type, attrs[type.name])
  if (type.isTextblock)
    fillNodeInline(node, fuel)
  else if (type.contains)
    fillNode(node, fuel)
  return node
}

export function createDoc(fuel) {
  return createNode(schema.nodes.doc, fuel || 1)
}

function childTypes(type, omit) {
  let contains = type.contains, result = []
  for (var name in schema.nodes) {
    let cur = schema.nodes[name]
    if (type.canContain(cur) && cur != omit) result.content.push(cur)
  }
  return result
}

function fillNode(node, fuel) {
  let types = childTypes(node.type)
  if (types.length == 0) return

  let children = Math.ceil(fuel * 5)
  for (let i = 0; i < children; i++) {
    let type = types[Math.floor(Math.random() * types.length)]
    node.content.push(createNode(type, fuel * 0.66))
  }
}

function fillNodeInline(node, fuel) {
  if (!node.type.containsStyles || Math.random() < .6) {
    node.content.push(schema.text(randomText(40)))
  } else {
    let types = childTypes(node.type, schema.nodes.text)
    let children = Math.ceil(fuel * 10)
    let styles = randomStyles()
    for (let i = 0; i < children; i++) {
      if (Math.random() < .75) {
        styles = modifyStyles(styles)
        node.content.push(schema.text(randomText(20), styles))
      } else {
        let type = types[Math.floor(Math.random() * types.length)]
        node.content.push(schema.node(type, attrs[type.name], null, styles))
      }
    }
  }
}

function randomStyles() {
  let styles = []
  if (Math.random() < .3) styles.push(defaultSchema.style("em"))
  if (Math.random() < .2) styles.push(defaultSchema.style("strong"))
  if (Math.random() < .2) styles.push(defaultSchema.style("link", {href: "http://foobar"}))
  if (Math.random() < .1) styles.push(defaultSchema.style("code"))
  return styles
}

function toggleStyle(styles, st) {
  if (st.isInSet(styles, st))
    return st.removeFromSet(styles)
  else
    return st.addToSet(styles)
}

function modifyStyles(styles) {
  let rnd = Math.random()
  if (rnd < .3) return toggleStyle(styles, defaultSchema.style("em"))
  if (rnd < .6) return toggleStyle(styles, defaultSchema.style("strong"))
  if (rnd < .85) return toggleStyle(styles, defaultSchema.style("link", {href: "http://foobar"}))
  return toggleStyle(styles, defaultSchema.style("code"))
}

function randomText(maxLen) {
  return text(Math.ceil(Math.random() * maxLen))
}

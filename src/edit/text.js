import {Span, Node, nodeTypes} from "../model"

export default {toText, fromText}

function fromText(text) {
  let blocks = text.trim().split("\n\n")
  let doc = new Node("doc")
  for (let i = 0; i < blocks.length; i++) {
    let para = new Node("paragraph")
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) para.push(new Span("hard_break"))
      para.push(Span.text(parts[j]))
    }
    doc.push(para)
  }
  return doc
}

function toText(doc) {
  let out = ""
  function explore(node) {
    if (node.type.block) {
      let text = ""
      for (let i = 0; i < node.content.length; i++) {
        let child = node.content[i]
        if (child.type == nodeTypes.text)
          text += child.text
        else if (child.type == nodeTypes.hard_break)
          text += "\n"
      }
      if (text) out += (out ? "\n\n" : "") + text
    } else {
      node.content.forEach(explore)
    }
  }
  explore(doc)
  return out
}

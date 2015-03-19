import {Node} from "../model"

export default {toText, fromText}

function fromText(text) {
  let blocks = text.trim().split("\n\n")
  let doc = new Node("doc")
  for (let i = 0; i < blocks.length; i++) {
    let para = new Node("paragraph")
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) para.push(new Node("hard_break"))
      para.push(Node.text(parts[j]))
    }
    doc.push(para)
  }
  return doc
}

function toText(doc) {
  let out = ""
  function explore(node) {
    if (node.type.contains == "inline") {
      let text = ""
      for (let i = 0; i < node.content.length; i++) {
        let child = node.content[i]
        if (child.type == Node.types.text)
          text += child.text
        else if (child.type == Node.types.hard_break)
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

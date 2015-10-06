import {defineTarget} from "./index"

export function toText(doc) {
  let out = ""
  function explore(node) {
    if (node.isTextblock) {
      let text = ""
      for (let i = 0; i < node.length; i++) {
        let child = node.child(i)
        if (child.isText)
          text += child.text
        else if (child.type == child.type.schema.nodeTypes.hard_break)
          text += "\n"
      }
      if (text) out += (out ? "\n\n" : "") + text
    } else {
      for (let i = 0; i < node.length; i++) explore(node.child(i))
    }
  }
  explore(doc)
  return out
}

defineTarget("text", toText)

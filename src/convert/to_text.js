import {nodeTypes} from "../model"
import {defineTarget} from "./index"

export function toText(doc) {
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

defineTarget("text", toText)

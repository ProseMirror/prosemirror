import ProseMirror from "../edit/main"
import fromText from "../markdown/from_text"
import toText from "../markdown/to_text"

ProseMirror.defineModule("markdown", {
  init() { return {fromText, toText} }
})

// FIXME define ways to get/set the editor content as text

import {insertCSS} from "../dom"
import {Plugin} from "../edit"

const cls = "ProseMirror-default-schema-style"
const scope = "." + cls + " .ProseMirror-content"

insertCSS(`

/* Add space around the hr to make clicking it easier */

${scope} hr {
  position: relative;
  height: 6px;
  border: none;
}

${scope} hr:after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: 2px;
  border-top: 2px solid silver;
}

${scope} img {
  cursor: default;
}

`)

// :: Plugin
// A plugin that enables a few CSS rules to make a ProseMirror editor
// with the default schema behave better.
//
// - Makes HR nodes bigger, so that you can click them to select them.
//
// - Gives IMG nodes a default mouse cursor.
export const defaultSchemaStyle = new Plugin(class {
  constructor(pm) {
    pm.wrapper.classList.add(cls)
  }
  detach(pm) {
    pm.wrapper.classList.remove(cls)
  }
})

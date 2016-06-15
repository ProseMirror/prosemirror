const {insertCSS} = require("../util/dom")

const cls = "ProseMirror-example-setup-style"
exports.className = cls
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

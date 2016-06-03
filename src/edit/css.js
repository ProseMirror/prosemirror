const {insertCSS} = require("../util/dom")

insertCSS(`

.ProseMirror {
  position: relative;
}

.ProseMirror-content {
  white-space: pre-wrap;
}

.ProseMirror-drop-target {
  position: absolute;
  width: 1px;
  background: #666;
  pointer-events: none;
}

.ProseMirror-content ul, .ProseMirror-content ol {
  padding-left: 30px;
  cursor: default;
}

.ProseMirror-content blockquote {
  padding-left: 1em;
  border-left: 3px solid #eee;
  margin-left: 0; margin-right: 0;
}

.ProseMirror-content pre {
  white-space: pre-wrap;
}

.ProseMirror-content li {
  position: relative;
  pointer-events: none; /* Don't do weird stuff with marker clicks */
}
.ProseMirror-content li > * {
  pointer-events: auto;
}

.ProseMirror-nodeselection *::selection { background: transparent; }
.ProseMirror-nodeselection *::-moz-selection { background: transparent; }

.ProseMirror-selectednode {
  outline: 2px solid #8cf;
}

/* Make sure li selections wrap around markers */

li.ProseMirror-selectednode {
  outline: none;
}

li.ProseMirror-selectednode:after {
  content: "";
  position: absolute;
  left: -32px;
  right: -2px; top: -2px; bottom: -2px;
  border: 2px solid #8cf;
  pointer-events: none;
}

`)

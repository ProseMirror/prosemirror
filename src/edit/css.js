import {insertCSS} from "../dom"

insertCSS(`

.ProseMirror {
  border: 1px solid silver;
  position: relative;
}

.ProseMirror-content {
  padding: 4px 8px 4px 14px;
  white-space: pre-wrap;
  line-height: 1.2;
}

.ProseMirror-drop-target {
  position: absolute;
  width: 1px;
  background: #666;
  display: none;
}

.ProseMirror-content ul.tight p, .ProseMirror-content ol.tight p {
  margin: 0;
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

.ProseMirror-selectednode {
  outline: 2px solid #8cf;
}

.ProseMirror-content p:first-child,
.ProseMirror-content h1:first-child,
.ProseMirror-content h2:first-child,
.ProseMirror-content h3:first-child,
.ProseMirror-content h4:first-child,
.ProseMirror-content h5:first-child,
.ProseMirror-content h6:first-child {
  margin-top: .3em;
}

/* Add space around the hr to make clicking it easier */

.ProseMirror-content hr {
  position: relative;
  height: 6px;
  border: none;
}

.ProseMirror-content hr:after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: 2px;
  border-top: 2px solid silver;
}

.ProseMirror-content img {
  cursor: default;
}

/* Make sure li selections wrap around markers */

.ProseMirror-content li {
  position: relative;
  pointer-events: none; /* Don't do weird stuff with marker clicks */
}
.ProseMirror-content li > * {
  pointer-events: auto;
}

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

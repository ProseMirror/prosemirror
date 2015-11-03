import insertCSS from "insert-css"

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
  padding-left: 2em;
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

img.ProseMirror-selectednode::selection {
  background: transparent;
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

.ProseMirror-content ul, .ProseMirror-content ol {
  padding-left: 0;
}

.ProseMirror-content li {
  list-style-type: none;
  padding-left: 32px;
  position: relative;
}

.ProseMirror-content li:before {
  position: absolute;
  right: calc(100% - 32px);
  padding-right: 8px;
}

.ProseMirror-content ul > li:before { content: "●" }
.ProseMirror-content ul ul > li:before { content: "○" }
.ProseMirror-content ul ul ul > li:before { content: "◾" }

.ProseMirror-content ol {
  counter-reset: prosemirror-list;
}

.ProseMirror-content ol > li:before {
  counter-increment: prosemirror-list;
  content: counter(prosemirror-list) ".";
}

`)

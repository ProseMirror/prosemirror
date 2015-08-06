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

.ProseMirror-content p:first-child,
.ProseMirror-content h1:first-child,
.ProseMirror-content h2:first-child,
.ProseMirror-content h3:first-child,
.ProseMirror-content h4:first-child,
.ProseMirror-content h5:first-child,
.ProseMirror-content h6:first-child {
  margin-top: .3em;
}

`)

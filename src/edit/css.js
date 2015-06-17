import insertCSS from "insert-css"
import {ie} from "./dom"

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

.ProseMirror-content p:empty:after,
.ProseMirror-content li:empty:after,
.ProseMirror-content h1:empty:after,
.ProseMirror-content h2:empty:after,
.ProseMirror-content h3:empty:after,
.ProseMirror-content h4:empty:after,
.ProseMirror-content h5:empty:after,
.ProseMirror-content h6:empty:after,
.ProseMirror-content pre:empty:after {
  content: "\u200b";
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

`)

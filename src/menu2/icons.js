import insertCSS from "insert-css"

insertCSS(`

.ProseMirror-icon-lift:after {
  content: "<";
}
.ProseMirror-icon-join:after {
  content: "^";
}
.ProseMirror-icon-image:after {
  content: "[o]";
}
.ProseMirror-icon-strong:after {
  content: "B";
}
.ProseMirror-icon-em:after {
  content: "i";
}
.ProseMirror-icon-link:after {
  content: "oo";
}
.ProseMirror-icon-code:after {
  content: "{}";
}
.ProseMirror-icon-list-ol:after {
  content: "1.";
}
.ProseMirror-icon-list-ul:after {
  content: "*";
}
.ProseMirror-icon-quote:after {
  content: "“";
}
.ProseMirror-icon-hr:after {
  content: "—";
}

`)

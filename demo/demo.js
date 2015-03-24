import ProseMirror from "../src/edit/main"
import {Node} from "../src/model"
import "../src/modules/autoinput"
import "../src/modules/inlinetooltip"
import "../src/modules/menu"

let doc = new Node("doc", [
  new Node("heading", [Node.text("Hello!")], {level: 1}),
  new Node("horizontal_rule"),
  new Node("paragraph", [Node.text("This is a "), Node.text("Markdown", [{type: "strong"}]), Node.text(" editor")]),
  new Node("ordered_list", [
    new Node("list_item", [new Node("paragraph", [Node.text("With a")])]),
    new Node("list_item", [new Node("paragraph", [Node.text("List of")])]),
    new Node("list_item", [new Node("paragraph", [Node.text("Three items")])])
  ])
])

let pm = window.pm = new ProseMirror({
  place: document.body,
  doc: doc,
  autoInput: true,
  inlineTooltip: true,
  menu: true
});

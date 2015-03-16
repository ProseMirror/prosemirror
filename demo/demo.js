import ProseMirror from "../src/edit/main"
import "../src/modules/magicInput"

var pm = window.pm = new ProseMirror({
  place: document.body,
  value: "# Hello!\n\n---\n\nThis is a **Markdown** editor\n\n- With a\n- List of\n- three items\n",
  modules: {magicInput: true}
});

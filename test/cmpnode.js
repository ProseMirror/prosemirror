import Failure from "./failure"
import * as style from "../src/model/style"

export default function cmpNode(a, b) {
  function raise(msg, path) {
    throw new Failure(msg + " at " + path + " in " + a + " vs " + b)
  }
  function inner(a, b, path) {
    if (a.type != b.type) raise("types differ", path)
    if (a.content.length != b.content.length) raise("different content length", path)
    for (var name in b.attrs) {
      if (!(name in a.attrs) && b.attrs[name])
        raise("missing attr " + name + " on left", path)
      if (a.attrs[name] != b.attrs[name])
        raise("attribute " + name + " mismatched -- " + a.attrs[name] + " vs " + b.attrs[name], path)
    }
    for (var name in a.attrs)
      if (!(name in b.attrs) && a.attrs[name])
        raise("missing attr " + name + " on right", path)
    if (a.type.type == "inline") {
      if (a.text != b.text) raise("different text", path)
      if (!style.sameSet(a.styles, b.styles)) raise("different styles", path)
    }
    for (var i = 0; i < a.content.length; i++)
      inner(a.content[i], b.content[i], path + "." + i)
  }
  inner(a, b, "doc")
}

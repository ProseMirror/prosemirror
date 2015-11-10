import {Failure} from "./failure"
import {Pos, sameStyles} from "../src/model"

export function cmpNode(a, b, comment) {
  function raise(msg, path) {
    throw new Failure(msg + " at " + path + "\n in " + a + "\n vs " + b + (comment ? " (" + comment + ")" : ""))
  }
  function inner(a, b, path) {
    if (a.type != b.type) raise("types differ", path)
    if (a.length != b.length) raise("different content length", path)
    for (var name in b.attrs) {
      if (!(name in a.attrs) && b.attrs[name])
        raise("missing attr " + name + " on left", path)
      if (a.attrs[name] != b.attrs[name])
        raise("attribute " + name + " mismatched -- " + a.attrs[name] + " vs " + b.attrs[name], path)
    }
    for (var name in a.attrs)
      if (!(name in b.attrs) && a.attrs[name])
        raise("missing attr " + name + " on right", path)
    if (a.text != null && a.text != b.text) raise("different text", path)
    if (a.styles && !sameStyles(a.styles, b.styles)) raise("different styles", path)
    for (var i = 0; i < a.length; i++)
      inner(a.child(i), b.child(i), path + "." + i)
  }
  inner(a, b, "doc")
}

export function cmpStr(a, b, comment) {
  let as = String(a), bs = String(b)
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}

export function cmp(a, b, comment) {
  if (a !== b)
    throw new Failure("expected " + b + ", got " + a + (comment ? " (" + comment + ")" : ""))
}

export function gt(a, b, comment) {
  if (a <= b)
    throw new Failure("expected " + a + " > " + b + (comment ? " (" + comment + ")" : ""))
}

export function lt(a, b, comment) {
  if (a >= b)
    throw new Failure("expected " + a + " < " + b + (comment ? " (" + comment + ")" : ""))
}

export function is(condition, comment) {
  if (!condition)
    throw new Failure("assertion failed" + (comment ? " (" + comment + ")" : ""))
}

export function P(...args) { return new Pos(args, args.pop()) }

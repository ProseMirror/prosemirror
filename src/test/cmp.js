import {Failure} from "./failure"
import {Pos, Mark} from "../model"

function fail(a, b, comment) {
  throw new Failure("different values:\n  " + a + "\nvs\n  " + b + (comment ? "\n(" + comment + ")" : ""))
}

export function cmpNode(a, b, comment) {
  if (a.type != b.type) fail(a, b, comment)
  for (var name in b.attrs) {
    if (!(name in a.attrs) && b.attrs[name] ||
        a.attrs[name] != b.attrs[name]) fail(a, b, comment)
  }
  for (var name in a.attrs)
    if (!(name in b.attrs) && a.attrs[name]) fail(a, b, comment)
  if (a.isText && a.text != b.text ||
      !Mark.sameSet(a.marks, b.marks)) fail(a, b, comment)
  cmpFragment(a.content, b.content, comment)
}

export function cmpFragment(a, b, comment) {
  if (a.childCount != b.childCount) fail(a, b, comment)
  for (let i = 0; i < a.childCount && i < b.childCount; i++)
    cmpNode(a.child(i), b.child(i))
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

import {Failure} from "./failure"
import {Pos, Mark} from "../model"

export function cmpNode(a, b, comment) {
  function fail(a, b) {
    throw new Failure("different nodes:\n  " + a + "\nvs\n  " + b + (comment ? "\n(" + comment + ")" : ""))
  }
  let add = comment ? " (" + comment + ")" : ""
  function inner(a, b) {
    if (a.type != b.type) fail(a, b)
    for (var name in b.attrs) {
      if (!(name in a.attrs) && b.attrs[name]) fail(a, b)
      if (a.attrs[name] != b.attrs[name]) fail(a, b)
    }
    for (var name in a.attrs)
      if (!(name in b.attrs) && a.attrs[name]) fail(a, b)
    if (a.isText && a.text != b.text) fail(a, b)
    if (a.marks && !Mark.sameSet(a.marks, b.marks)) fail(a, b)

    for (let i = 0;; i++) {
      if (i == a.childCount) {
        if (i == b.childCount) break
        fail(a, b)
      } else if (i == b.childCount) {
        fail(a, b)
      }
      inner(a.child(i), b.child(i))
    }
  }
  inner(a, b)
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

import {Failure} from "./failure"
import {Pos, Mark} from "../model"

export function cmpNode(a, b, comment) {
  function inner(a, b) {
    if (a.type != b.type) throw new Failure(`types differ: ${a.type.name} vs ${b.type.name}`)
    for (var name in b.attrs) {
      if (!(name in a.attrs) && b.attrs[name])
        throw new Failure("missing attr " + name + " on left in " + a.type.name)
      if (a.attrs[name] != b.attrs[name])
        throw new Failure("attribute " + name + " mismatched in " + a.type.name + " -- " + a.attrs[name] + " vs " + b.attrs[name])
    }
    for (var name in a.attrs)
      if (!(name in b.attrs) && a.attrs[name])
        throw new Failure("missing attr " + name + " on right in " + a.type.name)
    if (a.isText && a.text != b.text) throw new Failure("different text " + a.text + " vs " + b.text)
    if (a.marks && !Mark.sameSet(a.marks, b.marks)) throw new Failure("different marks in " + a + " vs " + b)

    for (let curA = a.cursor(), curB = b.cursor();;) {
      if (curA.atEnd) {
        if (curB.atEnd) break
        throw new Failure("Extra content in " + a.type.name + " on right: " + b.content.slice(curB.pos))
      } else if (curB.atEnd) {
        throw new Failure("Extra content in " + a.type.name + " on left: " + a.content.slice(curA.pos))
      }
      inner(curA.next(), curB.next())
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

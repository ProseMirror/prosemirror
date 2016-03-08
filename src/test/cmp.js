import {Failure} from "./failure"
import {Pos} from "../model"

export function cmpNode(a, b, comment) {
  if (!a.eq(b)) throw new Failure("Different nodes:\n  " + a + "\nvs\n  " +
                                  b + (comment ? "\n(" + comment + ")" : ""))
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

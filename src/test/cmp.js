const {Failure} = require("./failure")

function cmpNode(a, b, comment) {
  if (!a.eq(b)) throw new Failure("Different nodes:\n  " + a + "\nvs\n  " +
                                  b + (comment ? "\n(" + comment + ")" : ""))
}
exports.cmpNode = cmpNode

function cmpStr(a, b, comment) {
  let as = String(a), bs = String(b)
  if (as != bs)
    throw new Failure("expected " + bs + ", got " + as + (comment ? " (" + comment + ")" : ""))
}
exports.cmpStr = cmpStr

function cmp(a, b, comment) {
  if (a !== b)
    throw new Failure("expected " + b + ", got " + a + (comment ? " (" + comment + ")" : ""))
}
exports.cmp = cmp

function gt(a, b, comment) {
  if (a <= b)
    throw new Failure("expected " + a + " > " + b + (comment ? " (" + comment + ")" : ""))
}
exports.gt = gt

function lt(a, b, comment) {
  if (a >= b)
    throw new Failure("expected " + a + " < " + b + (comment ? " (" + comment + ")" : ""))
}
exports.lt = lt

function is(condition, comment) {
  if (!condition)
    throw new Failure("assertion failed" + (comment ? " (" + comment + ")" : ""))
}
exports.is = is

// ;; Superclass for ProseMirror-related errors. Does some magic to
// make it safely subclassable even on ES5 runtimes.
function ProseMirrorError(message) {
  Error.call(this, message)
  if (this.message != message) {
    this.message = message
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.name)
    else this.stack = (new Error(message)).stack
  }
}
exports.ProseMirrorError = ProseMirrorError

ProseMirrorError.prototype = Object.create(Error.prototype)

ProseMirrorError.prototype.constructor = ProseMirrorError

Object.defineProperty(ProseMirrorError.prototype, "name", {
  get() {
    return this.constructor.name || functionName(this.constructor) || "ProseMirrorError"
  }
})

function functionName(f) {
  let match = /^function (\w+)/.exec(f.toString())
  return match && match[1]
}

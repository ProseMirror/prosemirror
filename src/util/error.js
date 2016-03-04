// ;; Superclass for ProseMirror-related errors. Does some magic to
// make it safely subclassable even on ES5 runtimes.
export function ProseMirrorError(message) {
  Error.call(this, message)
  if (this.message != message) {
    this.message = message
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.name)
    else this.stack = (new Error(message)).stack
  }
}

ProseMirrorError.prototype = Object.create(Error.prototype)

ProseMirrorError.prototype.constructor = ProseMirrorError

Object.defineProperty(ProseMirrorError.prototype, "name", {
  get() {
    return this.constructor.name || functionName(this.constructor) || "ProseMirrorError"
  }
})

// ;; Error type used to signal miscellaneous invariant violations.
export class AssertionError extends ProseMirrorError {}

// ;; Error type used to report name clashes or other violations in
// namespacing.
export class NamespaceError extends ProseMirrorError {}

function functionName(f) {
  let match = /^function (\w+)/.exec(f.toString())
  return match && match[1]
}

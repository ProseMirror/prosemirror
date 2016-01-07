// ;; Superclass for ProseMirror-related errors. Does some magic to
// make it safely subclassable even on ES5 runtimes.
export class ProseMirrorError extends Error {
  // :: (string)
  // Create an instance of this error type, capturing the current
  // stack.
  constructor(message) {
    super(message)
    if (this.message != message) {
      this.message = message
      if (Error.captureStackTrace) Error.captureStackTrace(this, this.name)
      else this.stack = (new Error(message)).stack
    }
  }

  get name() {
    return this.constructor.name || functionName(this.constructor) || "ProseMirrorError"
  }

  // :: (string)
  // Raise an exception of this type, with the given message.
  // (Somewhat shorter than `throw new ...`, and can appear in
  // expression position.)
  static raise(message) {
    throw new this(message)
  }
}

function functionName(f) {
  let match = /^function (\w+)/.exec(f.toString())
  return match && match[1]
}

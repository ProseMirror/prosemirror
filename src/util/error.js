export class ProseMirrorError extends Error {
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

  static raise(message) {
    throw new this(message)
  }
}

function functionName(f) {
  let match = /^function (\w+)/.exec(f.toString())
  return match && match[1]
}

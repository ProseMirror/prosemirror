function Failure(message) {
  this.message = message
  this.stack = (new Error(message)).stack
}
exports.Failure = Failure
Failure.prototype = Object.create(Error.prototype)
Failure.prototype.name = "Failure"

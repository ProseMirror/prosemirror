export function Failure(message) {
  this.message = message;
  this.stack = (new Error(message)).stack;
}
Failure.prototype = Object.create(Error.prototype);
Failure.prototype.name = "Failure";

export default class Pos {
  constructor(path, offset, inBlock = true) {
    this.path = path
    this.offset = offset
    this.inBlock = inBlock
  }

  toString() {
    return this.path.join("/") + ":" + this.offset + (this.inBlock ? "" : "#")
  }
}

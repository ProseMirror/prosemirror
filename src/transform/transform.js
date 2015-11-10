import {Step} from "./step"
import {nullMap, MapResult} from "./map"

export class TransformResult {
  constructor(doc, map = nullMap) {
    this.doc = doc
    this.map = map
  }
}

export class Transform {
  constructor(doc) {
    this.docs = [doc]
    this.steps = []
    this.maps = []
  }

  get doc() {
    return this.docs[this.docs.length - 1]
  }

  get before() {
    return this.docs[0]
  }

  step(step, from, to, pos, param) {
    if (typeof step == "string")
      step = new Step(step, from, to, pos, param)
    let result = step.apply(this.doc)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      this.docs.push(result.doc)
    }
    return result
  }

  map(pos, bias) {
    let deleted = false
    for (let i = 0; i < this.maps.length; i++) {
      let result = this.maps[i].map(pos, bias)
      pos = result.pos
      if (result.deleted) deleted = true
    }
    return new MapResult(pos, deleted)
  }
}

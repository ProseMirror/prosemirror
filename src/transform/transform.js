import {Step, applyStep} from "./step"
import {nullMap} from "./map"

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
    let result = applyStep(this.doc, step)
    if (result) {
      this.steps.push(step)
      this.maps.push(result.map)
      this.docs.push(result.doc)
    }
    return result
  }

  map(pos, bias = 0) {
    for (let i = 0; i < this.maps.length; i++)
      pos = this.maps[i].map(pos, bias).pos
    return pos
  }
}

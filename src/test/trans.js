import {Transform, Step, Remapping} from "../transform"
import {cmpNode, cmpStr} from "./cmp"

function tag(tr, name) {
  return tr.map(tr.docs[0].tag[name]).pos
}

class Tr {
  constructor(steps) {
    this.steps = steps
  }

  plus(f) {
    return new Tr(this.steps.concat(f))
  }

  add(mark, from, to) {
    return this.plus(tr => tr.addMark(tag(tr, from || "a"), tag(tr, to || "b"), mark))
  }

  rem(mark, from, to) {
    return this.plus(tr => tr.removeMark(tag(tr, from || "a", tag(tr, to || "b"), mark)))
  }

  ins(nodes, at) {
    return this.plus(tr => tr.insert(tag(tr, at || "a"), nodes))
  }

  del(from, to) {
    return this.plus(tr => tr.delete(tag(tr, from || "a"), tag(tr, to || "b")))
  }

  txt(text, at) {
    return this.plus(tr => tr.insertText(tag(tr, at || "a"), text))
  }

  join(at) {
    return this.plus(tr => tr.join(tag(tr, at || "a")))
  }

  split(at, depth, type, attrs) {
    return this.plus(tr => tr.split(tag(tr, at || "a"), depth,
                                    type && tr.doc.type.schema.nodeType(type), attrs))
  }

  lift(from, to) {
    return this.plus(tr => tr.lift(tag(tr, from || "a"), tag(tr, to || "b")))
  }

  wrap(type, attrs, from, to) {
    return this.plus(tr => tr.wrap(tag(tr, from || "a"), tag(tr, to || "b"), tr.doc.type.schema.nodeType(type), attrs))
  }

  type(type, attrs, from, to) {
    return this.plus(tr => tr.setBlockType(tag(tr, from || "a"), tag(tr, to || "b"),
                                           tr.doc.type.schema.nodeType(type), attrs))
  }

  nodeType(type, attrs, at) {
    return this.plus(tr => tr.setNodeType(tag(tr, at || "a"), tr.doc.type.schema.nodeType(type), attrs))
  }

  repl(other, from, to) {
    return this.plus(tr => tr.replace(tag(tr, from || "a"), tag(tr, to || "b"),
                                      other && other.slice(other.tag.a, other.tag.b)))
  }

  get(doc) {
    let tr = new Transform(doc)
    for (let i = 0; i < this.steps.length; i++) this.steps[i](tr)
    return tr
  }
}

export const tr = new Tr([])

function invert(transform) {
  let doc = transform.doc, out = new Transform(doc)
  for (let i = transform.steps.length - 1; i >= 0; i--)
    out.step(transform.steps[i].invert(transform.docs[i], transform.maps[i]))
  return out
}

function testMapping(maps, pos, newPos, label) {
  let mapped = pos
  maps.forEach(m => mapped = m.map(mapped, 1).pos)
  cmpStr(mapped, newPos, label)

  let ident = {}
  for (let i = 0; i < maps.length; i++) ident[-i - 1] = i
  let remap = new Remapping(maps.map(x => x.invert()), maps, ident)
  cmpStr(remap.map(newPos, 1).pos, newPos, label + " back")
}

function testStepJSON(tr) {
  let newTR = new Transform(tr.before)
  tr.steps.forEach(step => newTR.step(Step.fromJSON(tr.doc.type.schema, step.toJSON())))
  cmpNode(tr.doc, newTR.doc)
}

export function testTransform(tr, expect) {
  cmpNode(tr.doc, expect)
  cmpNode(invert(tr).doc, tr.docs[0], "inverted")

  testStepJSON(tr)

  for (var tag in expect.tag) // FIXME Babel 6.5.1 screws this up when I use let
    testMapping(tr.maps, tr.docs[0].tag[tag], expect.tag[tag], tag)
}

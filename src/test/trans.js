const {Transform, Step, Remapping, TransformError, liftTarget, findWrapping} = require("../transform")
const {Node} = require("../model")
const {cmpNode, cmpStr} = require("./cmp")
const {Failure} = require("./failure")

function tag(tr, name) {
  let calc = /^(.*)([+-]\d+)$/.exec(name), extra = 0
  if (calc) { name = calc[1]; extra = +calc[2] }
  let pos = tr.before.tag[name]
  if (pos == null) return undefined
  return tr.map(pos) + extra
}

function mrk(tr, mark) {
  return mark && (typeof mark == "string" ? tr.doc.type.schema.mark(mark) : mark)
}

function range(tr, from, to) {
  let $from = tr.doc.resolve(tag(tr, from || "a")), toTag = tag(tr, to || "b")
  return $from.blockRange(toTag == null ? undefined : tr.doc.resolve(toTag))
}

class DelayedTransform {
  constructor(steps) {
    this.steps = steps
  }

  plus(f) {
    return new DelayedTransform(this.steps.concat(f))
  }

  addMark(mark, from, to) {
    return this.plus(tr => tr.addMark(tag(tr, from || "a"), tag(tr, to || "b"), mrk(tr, mark)))
  }

  rmMark(mark, from, to) {
    return this.plus(tr => tr.removeMark(tag(tr, from || "a"), tag(tr, to || "b"), mrk(tr, mark)))
  }

  ins(nodes, at) {
    return this.plus(tr => tr.insert(tag(tr, at || "a"), typeof nodes == "string" ? tr.doc.type.schema.node(nodes) : nodes))
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
    return this.plus(tr => {
      let r = range(tr, from, to)
      return tr.lift(r, liftTarget(r))
    })
  }

  wrap(type, attrs, from, to) {
    return this.plus(tr => {
      let r = range(tr, from, to)
      return tr.wrap(r, findWrapping(r, tr.doc.type.schema.nodeType(type), attrs))
    })
  }

  blockType(type, attrs, from, to) {
    return this.plus(tr => tr.setBlockType(tag(tr, from || "a"), tag(tr, to || "b"),
                                           tr.doc.type.schema.nodeType(type), attrs))
  }

  nodeType(type, attrs, at) {
    return this.plus(tr => tr.setNodeType(tag(tr, at || "a"), tr.doc.type.schema.nodeType(type), attrs))
  }

  repl(slice, from, to) {
    return this.plus(tr => {
      let s = slice instanceof Node ? slice.slice(slice.tag.a, slice.tag.b) : slice
      tr.replace(tag(tr, from || "a"), tag(tr, to || "b"), s)
    })
  }

  get(doc) {
    let tr = new Transform(doc)
    for (let i = 0; i < this.steps.length; i++) this.steps[i](tr)
    return tr
  }
}

const tr = new DelayedTransform([])
exports.tr = tr

function invert(transform) {
  let out = new Transform(transform.doc)
  for (let i = transform.steps.length - 1; i >= 0; i--)
    out.step(transform.steps[i].invert(transform.docs[i]))
  return out
}

function testMapping(maps, pos, newPos, label) {
  let mapped = pos
  maps.forEach(m => mapped = m.map(mapped, 1))
  cmpStr(mapped, newPos, label)

  let remap = new Remapping(maps.map(m => m.invert()), maps.length)
  for (let i = maps.length - 1; i >= 0; i--)
    remap.appendMap(maps[i], --remap.mapFrom)
  cmpStr(remap.map(pos, 1), pos, label + " round trip")
}

function testStepJSON(tr) {
  let newTR = new Transform(tr.before)
  tr.steps.forEach(step => newTR.step(Step.fromJSON(tr.doc.type.schema, step.toJSON())))
  cmpNode(tr.doc, newTR.doc)
}

function testTransform(delayedTr, doc, expect) {
  let tr
  try {
    tr = delayedTr.get(doc)
  } catch (e) {
    if (!(e instanceof TransformError)) throw e
    if (expect != "fail") throw new Failure("Transform failed unexpectedly: " + e)
    return
  }
  if (expect == "fail")
    throw new Failure("Transform succeeded unexpectedly")

  cmpNode(tr.doc, expect)
  cmpNode(invert(tr).doc, tr.before, "inverted")

  testStepJSON(tr)

  let maps = tr.maps
  for (var tag in expect.tag) // FIXME Babel 6.5.1 screws this up when I use let
    testMapping(maps, tr.before.tag[tag], expect.tag[tag], tag)
}
exports.testTransform = testTransform

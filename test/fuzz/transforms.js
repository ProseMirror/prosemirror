import {$fromJSON, $node, $text, nodeTypes, Pos, style} from "../../src/model"
import {Transform, joinPoint, canLift, canWrap} from "../../src/transform"
import {cmp, cmpStr} from "../cmp"
import {randomPos} from "./pos"
import {createDoc, attrs} from "./generate"
import {testTransform, sizeBetween, nodeSize} from "./test"

export const tests = Object.create(null)
const run = Object.create(null)

const logFile = __dirname + "/../../fuzz.log"
import {appendFileSync, readFileSync, writeFileSync} from "fs"

let debug = false

function runTest(type, doc, info, simple) {
  let tr = new Transform(doc)
  if (simple || debug) {
    run[type](tr, info)
    testTransform(tr)
  } else {
    try {
      run[type](tr, info)
      testTransform(tr)
    } catch(e) {
      console.log("! " + e.toString())
      appendFileSync(logFile, JSON.stringify({error: e.stack, type, doc: doc.toJSON(), info}) + "\n")
    }
  }
}

export function runCase(n) {
  let cases = readFileSync(logFile, "utf8").split("\n")
  let data = JSON.parse(cases[n])
  let doc = $fromJSON(data.doc), info = restoreObjs(data.info)
  console.log("running " + data.type, info)
  console.log("on " + doc)
  runTest(data.type, doc, info, true)
}

export function clearCase(n) {
  let cases = readFileSync(logFile, "utf8").split("\n")
  cases.splice(n, 1)
  writeFileSync(logFile, cases.join("\n"), "utf8")
}

function restoreObjs(obj) {
  for (let prop in obj) {
    let val = obj[prop]
    if (val && typeof val == "object") {
      if (val.path) {
        obj[prop] = Pos.fromJSON(val)
      } else if (val.content) {
        obj[prop] = $fromJSON(val)
      } else {
        restoreObjs(val)
      }
    }
  }
  return obj
}

let cachedSize = null, cachedSizeDoc = null
function docSize(doc) {
  if (cachedSizeDoc == doc) return cachedSize
  cachedSizeDoc = doc
  return cachedSize = nodeSize(doc)
}

let cachedStr = null, cachedStrDoc = null
function docStr(doc) {
  if (cachedStrDoc == doc) return cachedStr
  cachedStrDoc = doc
  return cachedStr = doc.toString()
}

tests.type = (doc, _, blockPositions) => {
  for (let i = 0; i < blockPositions.length; i++)
    runTest("type", doc, {pos: blockPositions[i]})
}

run.type = (tr, info) => {
  tr.insertText(info.pos, "°")
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]) + 1, "insert single char")
}

run.type = (tr, info) => {
  tr.insertText(info.pos, "°")
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]) + 1, "insert single char")
}

tests.delete = (doc, positions) => {
  for (let i = 0; i < positions.length; i++) {
    let from = positions[i]
    for (let j = i; j < positions.length; j++)
      runTest("delete", doc, {from: from, to: positions[j]})
  }
}

run.delete = (tr, info) => {
  tr.delete(info.from, info.to)
  let delSize = sizeBetween(tr.docs[0], info.from, info.to)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]) - delSize, "size reduced appropriately")
}

tests.insert = (doc, positions) => {
  let para = $node("paragraph", null, [$text("Q")])
  let img = $node("image", {src: "http://image2"})
  for (let i = 0; i < positions.length; i++) {
    let pos = positions[i], node = doc.path(pos.path)
    if (node.type.canContain(para.type))
      runTest("insert", doc, {pos: pos, node: para})
    else if (node.isTextblock)
      runTest("insert", doc, {pos: pos, node: img})
  }
}

run.insert = (tr, info) => {
  if (info.node.type.name == "image")
    tr.insertInline(info.pos, info.node)
  else
    tr.insert(info.pos, info.node)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]) + 1, "added one character")
}

tests.replace = (doc, positions) => {
  let source = createDoc()
  for (let i = 0; i < positions.length; i++) {
    for (let j = i; j < positions.length; j++) {
      let start = randomPos(source), end = randomPos(source)
      if (!start || !end) continue
      if (start.cmp(end) > 0) { let tmp = start; start = end; end = tmp }
      runTest("replace", doc, {from: positions[i], to: positions[j], source: source, start: start, end: end})
    }
  }
}

run.replace = (tr, info) => {
  tr.replace(info.from, info.to, info.source, info.start, info.end)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]) - sizeBetween(tr.docs[0], info.from, info.to) +
      sizeBetween(info.source, info.start, info.end), "replaced size matches")
}

tests.join = (doc, positions) => {
  let last = null
  for (let i = 0; i < positions.length; i++) {
    let point = joinPoint(doc, positions[i])
    if (point && (!last || last.cmp(point))) {
      runTest("join", doc, {pos: point})
      last = point
    }
  }
}

run.join = (tr, info) => {
  tr.join(info.pos)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "join doesn't change length")
}

tests.split = (doc, positions) => {
  for (let i = 0; i < positions.length; i++)
    runTest("split", doc, {pos: positions[i], depth: Math.floor(Math.random() * 3) + 1})
}

run.split = (tr, info) => {
  tr.split(info.pos, info.depth)
  if (tr.steps.length)
    cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "split doesn't change length")
}

tests.style = (doc, _, blockPositions) => {
  for (let i = 0; i < blockPositions.length; i++) {
    for (let j = i; j < blockPositions.length; j++) {
      let rnd = Math.random(), rnd2 = Math.random()
      let type = rnd < .33 ? "addStyle" : rnd < .66  ? "removeStyle" : "clearMarkup"
      let st = type != "clearMarkup" &&
          rnd2 < .3 ? style.em : rnd2 < .6 ? style.strong : rnd2 < .8 ? style.link("http://p") : style.code
      runTest("style", doc, {type: type, from: blockPositions[i], to: blockPositions[j], style: st})
    }
  }
}

run.style = (tr, info) => {
  tr[info.type](info.from, info.to, info.style)
  if (info.type != "clearMarkup")
    cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "style doesn't change length")
}

tests.lift = (doc, _, blockPositions) => {
  let last = null, x = 0
  for (let i = 0; i < blockPositions.length; i++) {
    let from = blockPositions[i]
    let to = blockPositions[Math.floor(Math.random() * (blockPositions.length - i)) + i]
    let lift = canLift(doc, from, to), p
    if (lift && (!last || (p = new Pos(lift.range.path, lift.range.from)).cmp(last))) {
      runTest("lift", doc, {from, to})
      last = p
    }
  }
}

run.lift = (tr, info) => {
  tr.lift(info.from, info.to)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "lift doesn't change size")
}

let blockTypes = [], wrapTypes = []
for (let name in nodeTypes) {
  let type = nodeTypes[name]
  if (type.textblock)
    blockTypes.push(type)
  else if (type.textblock)
    wrapTypes.push(type)
}

tests.wrap = (doc, positions) => {
  let last = null, x = 0
  for (let i = 0; i < positions.length; i++) {
    let from = positions[i], p
    let to = positions[Math.floor(Math.random() * (positions.length - i)) + i]
    let type = wrapTypes[Math.floor(Math.random() * wrapTypes.length)]
    let node = $node(type, attrs[type.name])
    let wrap = canWrap(doc, from, to, node)
    if (wrap && (!last || (p = new Pos(wrap.range.path, wrap.range.from)).cmp(last))) {
      runTest("wrap", doc, {from, to, node})
      last = p
    }
  }
}

run.wrap = (tr, info) => {
  tr.lift(info.from, info.to, info.node)
  cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "wrap doesn't change size")
}

tests.setBlockType = (doc, _, blockPositions) => {
  for (let i = 0; i < blockPositions.length; i++) {
    let from = blockPositions[i]
    let to = blockPositions[Math.floor(Math.random() * blockPositions.length - i) + i]
    let type = blockTypes[Math.floor(Math.random() * blockTypes.length)]
    runTest("setBlockType", doc, {from, to, node: $node(type, attrs[type.name])})
  }
}

run.setBlockType = (tr, info) => {
  tr.setBlockType(info.from, info.to, info.node)
  if (!info.node.type.plainText)
    cmp(nodeSize(tr.doc), docSize(tr.docs[0]), "setBlockType doesn't change size")
}

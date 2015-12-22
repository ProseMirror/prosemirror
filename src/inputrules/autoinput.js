import {Pos, BlockQuote, OrderedList, BulletList, CodeBlock, Heading} from "../model"
import {defineOption} from "../edit"
import {Rule, addInputRule, removeInputRule} from "./inputrules"

defineOption("autoInput", false, function(pm, val) {
  if (pm.mod.autoInput) {
    pm.mod.autoInput.forEach(name => removeInputRule(pm, name))
    pm.mod.autoInput = null
  }
  if (val) {
    let rules = schemaRules(pm.schema)
    let list = Array.isArray(val) ? val : Object.keys(rules)
    list.forEach(name => addInputRule(pm, rules[name]))
    pm.mod.autoInput = list
  }
})

function schemaRules(schema) {
  let cached = schema.cached.inputRules
  if (cached) return cached

  let found = Object.create(null)
  for (let name in globalRules) found[name] = globalRules[name]

  schema.registry("autoInput", (spec, type) => {
    let handler = spec.handler
    if (handler.bind) handler = handler.bind(type)
    found[spec.name] = new Rule(spec.name, spec.match, spec.filter, handler)
  })
  return schema.cached.inputRules = found
}

const globalRules = Object.create(null)

;[
  new Rule("emDash", /--$/, "-", "—"),
  new Rule("openDoubleQuote", /\s(")$/, '"', "“"),
  new Rule("closeDoubleQuote", /"$/, '"', "”"),
  new Rule("openSingleQuote", /\s(')$/, "'", "‘"),
  new Rule("closeSingleQuote", /'$/, "'", "’")
].forEach(rule => globalRules[rule.name] = rule)

export function defineRule(spec) {
  globalRules[spec.name] = new Rule(spec.name, spec.match, spec.trigger, spec.handler)
}

BlockQuote.register("autoInput", {
  name: "startBlockQuote",
  match: /^\s*> $/,
  trigger: " ",
  handler: function(pm, _, pos) { wrapAndJoin(pm, pos, this) }
})

OrderedList.register("autoInput", {
  name: "startOrderedList",
  match: /^(\d+)\. $/,
  trigger: " ",
  handler: function(pm, match, pos) {
    let order = +match[1]
    wrapAndJoin(pm, pos, this, {order: order || null},
                node => node.size + (node.attrs.order || 1) == order)
  }
})

BulletList.register("autoInput", {
  name: "startBulletList",
  match: /^\s*([-+*]) $/,
  trigger: " ",
  handler: function(pm, match, pos) {
    let bullet = match[1]
    wrapAndJoin(pm, pos, this, null, node => node.attrs.bullet == bullet)
  }
})

CodeBlock.register("autoInput", {
  name: "startCodeBlock",
  match: /^```$/,
  trigger: "`",
  handler: function(pm, _, pos) {
    setAs(pm, pos, this, {params: ""})
  }
})

Heading.register("autoInput", {
  name: "startHeading",
  match: /^(#{1,6}) $/,
  trigger: " ",
  handler: function(pm, match, pos) {
    setAs(pm, pos, this, {level: match[1].length})
  }
})

function wrapAndJoin(pm, pos, type, attrs = null, predicate = null) {
  let before = pos.shorten()
  let sibling = before.offset > 0 && pm.doc.path(before.path).child(before.offset - 1)
  let join = sibling && sibling.type.name == type && (!predicate || predicate(sibling))
  let tr = pm.tr.wrap(pos, pos, type, attrs)
  let delPos = tr.map(pos).pos
  tr.delete(new Pos(delPos.path, 0), delPos)
  if (join) tr.join(before)
  tr.apply()
}

function setAs(pm, pos, type, attrs) {
  pm.tr.setBlockType(pos, pos, type, attrs)
       .delete(new Pos(pos.path, 0), pos)
       .apply()
}

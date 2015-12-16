import {Pos} from "../model"
import {defineOption} from "../edit"
import {Rule, addInputRules, removeInputRules} from "./inputrules"

defineOption("autoInput", false, function(pm, val, old) {
  if (val && !old) addInputRules(pm, rules)
  else if (!val && old) removeInputRules(pm, rules)
})

// FIXME attach node-specific rules to node types, rather than
// hard-coding the node names.

export var rules = [
  new Rule("-", /--$/, "—"),
  new Rule('"', /\s(")$/, "“"),
  new Rule('"', /"$/, "”"),
  new Rule("'", /\s(')$/, "‘"),
  new Rule("'", /'$/, "’"),

  new Rule(" ", /^\s*> $/, function(pm, _, pos) {
    wrapAndJoin(pm, pos, pm.schema.nodeType("blockquote"))
  }),
  new Rule(" ", /^(\d+)\. $/, function(pm, match, pos) {
    let order = +match[1]
    wrapAndJoin(pm, pos, pm.schema.nodeType("ordered_list"), {order: order || null},
                node => node.size + (node.attrs.order || 1) == order)
  }),
  new Rule(" ", /^\s*([-+*]) $/, function(pm, match, pos) {
    let bullet = match[1]
    wrapAndJoin(pm, pos, pm.schema.nodeType("bullet_list"), null,
                node => node.attrs.bullet == bullet)
  }),
  new Rule("`", /^```$/, function(pm, _, pos) {
    setAs(pm, pos, pm.schema.nodeType("code_block"), {params: ""})
  }),
  new Rule(" ", /^(#{1,6}) $/, function(pm, match, pos) {
    setAs(pm, pos, pm.schema.nodeType("heading"), {level: match[1].length})
  })
]

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

import {Pos} from "../model"
import {defineOption} from "../edit"
import {wrappableRange, joinPoint} from "../transform"
import {Rule, addInputRules, removeInputRules} from "./inputrules"

defineOption("autoInput", false, function(pm, val, old) {
  if (val && !old) addInputRules(pm, rules)
  else if (!val && old) removeInputRules(pm, rules)
})

export var rules = [
  new Rule("-", /--$/, "—"),
  new Rule('"', /\s(")$/, "“"),
  new Rule('"', /"$/, "”"),
  new Rule("'", /\s(')$/, "‘"),
  new Rule("'", /'$/, "’"),

  new Rule(" ", /^\s*> $/, function(pm, _, pos) {
    wrapAndJoin(pm, pos, "blockquote")
  }),
  new Rule(" ", /^(\d+)\. $/, function(pm, match, pos) {
    let order = +match[1]
    wrapAndJoin(pm, pos, "ordered_list", {order: order || null, tight: true},
                node => node.content.length + (node.attrs.order || 1) == order)
  }),
  new Rule(" ", /^\s*([-+*]) $/, function(pm, match, pos) {
    let bullet = match[1]
    wrapAndJoin(pm, pos, "bullet_list", {bullet: bullet, tight: true},
                node => node.attrs.bullet == bullet)
  }),
  new Rule("`", /^```$/, function(pm, _, pos) {
    setAs(pm, pos, "code_block", {params: ""})
  }),
  new Rule(" ", /^(#{1,6}) $/, function(pm, match, pos) {
    setAs(pm, pos, "heading", {level: match[1].length})
  })
]

function wrapAndJoin(pm, pos, type, attrs = null, predicate = null) {
  let parentOffset = pos.path[pos.path.length - 1]
  let sibling = parentOffset > 0 && pm.doc.path(pos.shorten()).content[parentOffset - 1]
  let join = sibling.type.name == type && (!predicate || predicate(sibling))
  let range = wrappableRange(pm.doc, pos, pos)
  pm.apply({name: "wrap", pos: range.from, end: range.to, type: type, attrs: attrs})
  pos = pm.selection.head
  pm.apply({name: "replace", pos: new Pos(pos.path, 0), end: pos})
  if (join) pm.apply(joinPoint(pm.doc, pm.selection.head))
}

function setAs(pm, pos, type, attrs) {
  pm.apply({name: "setType", pos: pos, type: type, attrs: attrs})
  pos = pm.selection.head
  pm.apply({name: "replace", pos: new Pos(pos.path, 0), end: pos})
}

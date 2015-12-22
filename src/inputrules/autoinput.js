import {Pos, BlockQuote, OrderedList, BulletList, CodeBlock, Heading} from "../model"
import {defineOption, defaultRegistry} from "../edit"
import {InputRule, addInputRule, removeInputRule} from "./inputrules"

// :: bool #path=autoInput #kind=option
// When set to true, enables the input rules stored under the
// `"autoInput"` name in the editor's
// [`registry`](#ProseMirror.registry)—by default, these are things
// like smart quotes, and automatically wrapping a block in a list if
// you start it with `"1. "`.
defineOption("autoInput", false, function(pm, val) {
  if (pm.mod.autoInput) {
    pm.mod.autoInput.forEach(name => removeInputRule(pm, name))
    pm.mod.autoInput = null
  }
  if (val) {
    pm.mod.autoInput = []
    pm.registry("autoInput", (rule, type) => {
      pm.mod.autoInput.push(rule.name)
      if (rule.handler.bind)
        rule = new InputRule(rule.name, rule.match, rule.filter, rule.handler.bind(type))
      addInputRule(pm, rule)
    })
  }
})

defaultRegistry.register("autoInput", new InputRule("emDash", /--$/, "-", "—"))

defaultRegistry.register("autoInput", new InputRule("openDoubleQuote", /\s(")$/, '"', "“"))

defaultRegistry.register("autoInput", new InputRule("closeDoubleQuote", /"$/, '"', "”"))

defaultRegistry.register("autoInput", new InputRule("openSingleQuote", /\s(')$/, "'", "‘"))

defaultRegistry.register("autoInput", new InputRule("closeSingleQuote", /'$/, "'", "’"))

BlockQuote.register("autoInput", new InputRule("startBlockQuote", /^\s*> $/, " ",
                                               function(pm, _, pos) { wrapAndJoin(pm, pos, this) }))

OrderedList.register("autoInput", new InputRule("startOrderedList", /^(\d+)\. $/, " ", function(pm, match, pos) {
  let order = +match[1]
  wrapAndJoin(pm, pos, this, {order: order || null},
              node => node.size + (node.attrs.order || 1) == order)
}))

BulletList.register("autoInput", new InputRule("startBulletList", /^\s*([-+*]) $/, " ", function(pm, match, pos) {
  let bullet = match[1]
  wrapAndJoin(pm, pos, this, null, node => node.attrs.bullet == bullet)
}))

CodeBlock.register("autoInput", new InputRule("startCodeBlock", /^```$/, "`", function(pm, _, pos) {
  setAs(pm, pos, this, {params: ""})
}))

Heading.register("autoInput", new InputRule("startHeading", /^(#{1,6}) $/, " ", function(pm, match, pos) {
  setAs(pm, pos, this, {level: match[1].length})
}))

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

import {Pos, BlockQuote, OrderedList, BulletList, CodeBlock, Heading} from "../model"
import {defineOption} from "../edit"
import {InputRule, addInputRule, removeInputRule} from "./inputrules"

// :: Object<InputRule>
// Base set of input rules, enabled by default when `autoInput` is set
// to `true`.
export const autoInputRules = Object.create(null)

// :: union<bool, [union<InputRule, string, Object<?InputRule>>]> #path=autoInput #kind=option
// Controls the [input rules](#InputRule) initially active in the
// editor. Pass an array of sources, which can be either an input
// rule, the string `"schema"`, to add rules
// [registered](#SchemaItem.register) on the schema items (under the
// string `"autoInput"`), or an object containing input rules. To
// remove previously included rules, you can add an object that maps
// their name to `null`.
//
// The value `false` (the default) is a shorthand for no input rules,
// and the value `true` for `["schema", autoInputRules]`.
defineOption("autoInput", false, function(pm, val) {
  if (pm.mod.autoInput) {
    pm.mod.autoInput.forEach(name => removeInputRule(pm, name))
    pm.mod.autoInput = null
  }
  if (val) {
    if (val === true) val = ["schema", autoInputRules]
    let rules = Object.create(null), list = pm.mod.autoInput = []
    val.forEach(spec => {
      if (spec === "schema") {
        pm.schema.registry("autoInput", (rule, type, name) => {
          let rname = name + ":" + rule.name, handler = rule.handler
          if (handler.bind) handler = handler.bind(type)
          rules[rname] = new InputRule(rname, rule.match, rule.filter, handler)
        })
      } else if (spec instanceof InputRule) {
        rules[spec.name] = spec
      } else {
        for (let name in spec) {
          let val = spec[name]
          if (val == null) delete rules[name]
          else rules[name] = val
        }
      }
    })
    for (let name in rules) {
      addInputRule(pm, rules[name])
      list.push(rules[name].name)
    }
  }
})

autoInputRules.emDash = new InputRule("emDash", /--$/, "-", "—")

autoInputRules.openDoubleQuote = new InputRule("openDoubleQuote", /\s(")$/, '"', "“")

autoInputRules.closeDoubleQuote = new InputRule("closeDoubleQuote", /"$/, '"', "”")

autoInputRules.openSingleQuote = new InputRule("openSingleQuote", /\s(')$/, "'", "‘")

autoInputRules.closeSingleQuote = new InputRule("closeSingleQuote", /'$/, "'", "’")

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

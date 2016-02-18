import {Pos, BlockQuote, OrderedList, BulletList, CodeBlock, Heading} from "../model"
import {defineOption} from "../edit"
import {InputRule, addInputRule, removeInputRule} from "./inputrules"

// :: Object<InputRule>
// Base set of input rules, enabled by default when `autoInput` is set
// to `true`.
export const autoInputRules = Object.create(null)

export class AutoInputRule extends InputRule {
  constructor(match, filter, handler, options = {}) {
    super(match, filter, handler)
    this.runOnPaste = options.runOnPaste !== undefined ? options.runOnPaste : true
  }
  get nonEndMatch() {
    let flags = ""
    if(this.match.ignoreCase) {
      flags += "i"
    }
    if(this.match.global) {
      flags += "g"
    }
    if(this.match.multiline) {
      flags += "m"
    }
    let source = this.match.source
    if(source.substr(source.length - 1) === "$") {
      source = source.substring(0, source.length - 1)
    }

    return new RegExp(source, flags)
  }
}

function onPasted (pm, from, to) {
  let pasteFragment = pm.doc.sliceBetween(from, to)

  function fixFragment(transform) {
    from = transform.map(from).pos
    to = transform.map(to).pos
    pasteFragment = pm.doc.sliceBetween(from, to)
  }

  pm.on('transform', fixFragment)
  /*
  let transforms = []
  function transformPos(pos) {
    for(let i=0;i<transforms.length;i++) {
      pos = transforms.map(pos).pos
    }
    return pos
  }
  */

  function docPath(path) {
    let fromPath = [].concat(from.path)
    let fragmentPath = [].concat(path)
    fromPath[fromPath.length - 1] += fragmentPath.shift()
    if(fragmentPath.length) {
      fromPath = fromPath.concat(fragmentPath)
    }
    return fromPath
  }

  function processBlock(node, path = []) {
    if(node.isTextblock) {
      for(let ai=0; ai<pm.mod.autoInput.length; ai++) {
        let rule = pm.mod.autoInput[ai]
        if(rule.runOnPaste) {
          let match
          if(match = rule.nonEndMatch.exec(node.textContent)) {
            let pos = new Pos(docPath(path), (path[0] === 0 ? from.offset : 0) + node.textContent.search(rule.nonEndMatch) + match[0].length)

            if (typeof rule.handler == "string") {
              let offset = pos.offset - (match[1] || match[0]).length
              let start = new Pos(pos.path, offset)
              let marks = pm.doc.marksAt(pos)
              pm.tr.delete(start, pos)
                        .insert(start, pm.schema.text(rule.handler, marks))
                        .apply()
            } else {
              rule.handler(pm, match, pos)
            }
            return true
          }
        }
      }
    } else if(node.isBlock) {
      let blockIter = node.content.iter()
      let block
      let i = 0;
      while(!(block = blockIter.next()).done) {
        if(processBlock(block, [].concat(path, i))) return true
        i++
      }
    }
    return false
  }
  while(processBlock(pasteFragment)) {}

  pm.off('transform', fixFragment)

}


// :: union<bool, [union<string, Object<?InputRule>>]> #path=autoInput #kind=option
// Controls the [input rules](#InputRule) initially active in the
// editor. Pass an array of sources, which can be either the string
// `"schema"`, to add rules [registered](#SchemaItem.register) on the
// schema items (under the namespace `"autoInput"`), or an object
// containing input rules. To remove previously included rules, you
// can add an object that maps their name to `null`.
//
// The value `false` (the default) is a shorthand for no input rules,
// and the value `true` for `["schema", autoInputRules]`.
defineOption("autoInput", false, function(pm, val) {
  function pasteFunction(start, end) {
    onPasted(pm, start, end)
  }
  if (pm.mod.autoInput) {
    pm.mod.autoInput.forEach(rule => removeInputRule(pm, rule))
    pm.mod.autoInput = null
    pm.off("pasted", pasteFunction)
  }
  if (val) {
    if (val === true) val = ["schema", autoInputRules]
    let rules = Object.create(null), list = pm.mod.autoInput = []
    val.forEach(spec => {
      if (spec === "schema") {
        pm.schema.registry("autoInput", (name, rule, type, typeName) => {
          let rname = typeName + ":" + name, handler = rule.handler
          if (handler.bind) handler = handler.bind(type)
          rules[rname] = new AutoInputRule(rule.match, rule.filter, handler)
        })
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
      list.push(rules[name])
    }
    pm.on("pasted", pasteFunction)

  }
})

autoInputRules.emDash = new AutoInputRule(/--$/, "-", "—")

autoInputRules.openDoubleQuote = new AutoInputRule(/(?:^|[\s\{\[\(\<\u2018\u201C])(")$/, '"', "“")

autoInputRules.closeDoubleQuote = new AutoInputRule(/"$/, '"', "”")

autoInputRules.openSingleQuote = new AutoInputRule(/(?:^|[\s\{\[\(\<\u2018\u201C])(')$/, "'", "‘")

autoInputRules.closeSingleQuote = new AutoInputRule(/'$/, "'", "’")

BlockQuote.register("autoInput", "startBlockQuote", new AutoInputRule(
  /^\s*> $/, " ",
  function(pm, _, pos) { wrapAndJoin(pm, pos, this) }
))

OrderedList.register("autoInput", "startOrderedList", new AutoInputRule(
  /^(\d+)\. $/, " ",
  function(pm, match, pos) {
    let order = +match[1]
    wrapAndJoin(pm, pos, this, {order: order || null},
                node => node.size + (node.attrs.order || 1) == order)
  }
))

BulletList.register("autoInput", "startBulletList", new AutoInputRule(
  /^\s*([-+*]) $/, " ",
  function(pm, match, pos) {
    let bullet = match[1]
    wrapAndJoin(pm, pos, this, null, node => node.attrs.bullet == bullet)
  }
))

CodeBlock.register("autoInput", "startCodeBlock", new AutoInputRule(
  /^```$/, "`",
  function(pm, _, pos) { setAs(pm, pos, this, {params: ""}) }
))

Heading.registerComputed("autoInput", "startHeading", type => {
  let re = new RegExp("^(#{1," + type.maxLevel + "}) $")
  return new AutoInputRule(re, " ", function(pm, match, pos) {
    setAs(pm, pos, this, {level: match[1].length})
  })
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

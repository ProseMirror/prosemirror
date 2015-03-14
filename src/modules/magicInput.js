import {defineModule} from "../module"
import {Pos} from "../model"
import "./interpretInput"

defineModule("magicInput", {
  init(pm) {
    let ii = pm.modules.interpretInput
    ii.defineRule(/--$/, "—")
    ii.defineRule(/\s(")$/,  "“")
    ii.defineRule(/"$/, "”")
    ii.defineRule(/\s(')$/, "‘")
    ii.defineRule(/'$/, "’")

    ii.defineRule(/^\s*> $/, function(pm, _, pos) {
      wrapAndJoin(pm, pos, "blockquote")
    })
    ii.defineRule(/^(\d+)\. $/, function(pm, match, pos) {
      let start = +match[1]
      wrapAndJoin(pm, pos, "ordered_list", {start: start || null, tight: true},
                  node => node.content.length == start - 1)
    })
    ii.defineRule(/^\s*([-+*]) $/, function(pm, match, pos) {
      let bullet = match[1]
      wrapAndJoin(pm, pos, "bullet_list", {bullet: bullet, tight: true},
                  node => node.attrs.bullet == bullet)
    })

    ii.defineRule(/^```$/, function(pm, _, pos) {
      setAs(pm, pos, "code_block", {params: ""})
    })
    ii.defineRule(/^(#{1,6}) $/, function(pm, match, pos) {
      setAs(pm, pos, "heading", {level: match[1].length})
    })
  },

  dependencies: {
    interpretInput: true
  }
})

function wrapAndJoin(pm, pos, type, attrs = null, predicate = null) {
  let parentOffset = pos.path[pos.path.length - 1]
  let sibling = parentOffset > 0 && pm.doc.path(pos.shorten()).content[parentOffset - 1]
  let join = sibling.type.name == type && (!predicate || predicate(sibling))
  pm.apply({name: "wrap", pos: pos, type: type, attrs: attrs})
  pos = pm.selection.head
  pm.apply({name: "replace", pos: new Pos(pos.path, 0), end: pos})
  if (join) pm.apply({name: "join", pos: pm.selection.head})
}

function setAs(pm, pos, type, attrs) {
  pm.apply({name: "setType", pos: pos, type: type, attrs: attrs})
  pos = pm.selection.head
  pm.apply({name: "replace", pos: new Pos(pos.path, 0), end: pos})
}

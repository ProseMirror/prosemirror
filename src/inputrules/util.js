const {InputRule} = require("./inputrules")
const {findWrapping, joinable} = require("../transform")

// :: (RegExp, string, NodeType, ?union<Object, ([string]) → ?Object>, ?([string], Node) → bool) → InputRule
// Build an input rule for automatically wrapping a textblock when a
// given string is typed. The `regexp` and `filter` arguments are
// directly passed through to the `InputRule` constructor. You'll
// probably want the regexp to start with `^`, so that the pattern can
// only occur at the start of a textblock.
//
// `nodeType` is the type of node to wrap in. If it needs attributes,
// you can either pass them directly, or pass a function that will
// compute them from the regular expression match.
//
// By default, if there's a node with the same type above the newly
// wrapped node, the rule will try to [join](#Transform.join) those
// two nodes. You can pass a join predicate, which takes a regular
// expression match and the node before the wrapped node, and can
// return a boolean to indicate whether a join should happen.
function wrappingInputRule(regexp, filter, nodeType, getAttrs, joinPredicate) {
  return new InputRule(regexp, filter, (pm, match, pos) => {
    let start = pos - match[0].length
    let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
    let tr = pm.tr.delete(start, pos)
    let $pos = tr.doc.resolve(start), range = $pos.blockRange(), wrapping = range && findWrapping(range, nodeType, attrs)
    if (!wrapping) return
    tr.wrap(range, wrapping)
    let before = tr.doc.resolve(start - 1).nodeBefore
    if (before && before.type == nodeType && joinable(tr.doc, start - 1) &&
        (!joinPredicate || joinPredicate(match, before)))
      tr.join(start - 1)
    tr.apply()
  })
}
exports.wrappingInputRule = wrappingInputRule

// :: (RegExp, string, NodeType, ?union<Object, ([string]) → ?Object>) → InputRule
// Build an input rule that changes the type of a textblock when the
// matched text is typed into it. You'll usually want to start your
// regexp with `^` to that it is only matched at the start of a
// textblock. The optional `getAttrs` parameter can be used to compute
// the new node's attributes, and works the same as in the
// `wrappingInputRule` function.
function textblockTypeInputRule(regexp, filter, nodeType, getAttrs) {
  return new InputRule(regexp, filter, (pm, match, pos) => {
    let $pos = pm.doc.resolve(pos), start = pos - match[0].length
    let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
    if (!$pos.node(-1).canReplaceWith($pos.index(-1), $pos.indexAfter(-1), nodeType, attrs)) return
    return pm.tr
      .delete(start, pos)
      .setBlockType(start, start, nodeType, attrs)
      .apply()
  })
}
exports.textblockTypeInputRule = textblockTypeInputRule


// :: (NodeType) → InputRule
// Given a blockquote node type, returns an input rule that turns `"> "`
// at the start of a textblock into a blockquote.
function blockQuoteRule(nodeType) {
  return wrappingInputRule(/^\s*> $/, " ", nodeType)
}
exports.blockQuoteRule = blockQuoteRule

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
function orderedListRule(nodeType) {
  return wrappingInputRule(/^(\d+)\. $/, " ", nodeType, match => ({order: +match[1]}),
                           (match, node) => node.childCount + node.attrs.order == +match[1])
}
exports.orderedListRule = orderedListRule

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a
// bullet list.
function bulletListRule(nodeType) {
  return wrappingInputRule(/^\s*([-+*]) $/, " ", nodeType)
}
exports.bulletListRule = bulletListRule

// :: (NodeType) → InputRule
// Given a code block node type, returns an input rule that turns a
// textblock starting with three backticks into a code block.
function codeBlockRule(nodeType) {
  return textblockTypeInputRule(/^```$/, "`", nodeType)
}
exports.codeBlockRule = codeBlockRule

// :: (NodeType, number) → InputRule
// Given a node type and a maximum level, creates an input rule that
// turns up to that number of `#` characters followed by a space at
// the start of a textblock into a heading whose level corresponds to
// the number of `#` signs.
function headingRule(nodeType, maxLevel) {
  return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "}) $"), " ",
                                nodeType, match => ({level: match[1].length}))
}
exports.headingRule = headingRule

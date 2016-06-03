const {wrappingInputRule, textblockTypeInputRule} = require("../inputrules")
const {Heading, OrderedList, BulletList, BlockQuote, CodeBlock} = require("./index")

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

// :: (Schema) → [InputRule]
// A set of input rules for the default schema, using all of the
// builder functions from this module.
function defaultRules(schema) {
  let result = []
  for (let name in schema.nodes) {
    let node = schema.nodes[name]
    if (node instanceof BlockQuote) result.push(blockQuoteRule(node))
    if (node instanceof OrderedList) result.push(orderedListRule(node))
    if (node instanceof BulletList) result.push(bulletListRule(node))
    if (node instanceof CodeBlock) result.push(codeBlockRule(node))
    if (node instanceof Heading) result.push(headingRule(node, 6))
  }
  return result
}
exports.defaultRules = defaultRules

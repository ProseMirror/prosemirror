import {wrappingInputRule, textblockTypeInputRule} from "../inputrules"
import {defaultSchema} from "./index"

// :: (NodeType) → InputRule
// Given a blockquote node type, returns an input rule that turns `"> "`
// at the start of a textblock into a blockquote.
export function blockQuoteRule(nodeType) {
  return wrappingInputRule(/^\s*> $/, " ", nodeType)
}

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
export function orderedListRule(nodeType) {
  return wrappingInputRule(/^(\d+)\. $/, " ", nodeType, match => ({order: +match[1]}),
                           (match, node) => node.childCount + node.attrs.order == +match[1])
}

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a
// bullet list.
export function bulletListRule(nodeType) {
  return wrappingInputRule(/^\s*([-+*]) $/, " ", nodeType)
}

// :: (NodeType) → InputRule
// Given a code block node type, returns an input rule that turns a
// textblock starting with three backticks into a code block.
export function codeBlockRule(nodeType) {
  return textblockTypeInputRule(/^```$/, "`", nodeType)
}

// :: (NodeType, number) → InputRule
// Given a node type and a maximum level, creates an input rule that
// turns up to that number of `#` characters followed by a space at
// the start of a textblock into a heading whose level corresponds to
// the number of `#` signs.
export function headingRule(nodeType, maxLevel) {
  return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "}) $"), " ",
                                nodeType, match => ({level: match[1].length}))
}

// :: [InputRule]
// A set of input rules for the default schema, using all of the
// builder functions from this module.
export const defaultRules = [
  blockQuoteRule(defaultSchema.nodes.blockquote),
  orderedListRule(defaultSchema.nodes.ordered_list),
  bulletListRule(defaultSchema.nodes.bullet_list),
  codeBlockRule(defaultSchema.nodes.code_block),
  headingRule(defaultSchema.nodes.heading, 6)
]

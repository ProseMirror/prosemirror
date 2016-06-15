// !! This module defines a plugin for attaching ‘input rules’ to an
// editor, which can react to or transform text typed by the user. It
// also comes with a bunch of default rules that can be enabled in
// this plugin.

;({InputRule: exports.InputRule, inputRules: exports.inputRules, InputRules: exports.InputRules} = require("./inputrules"))
;({emDash: exports.emDash, ellipsis: exports.ellipsis, openDoubleQuote: exports.openDoubleQuote,
   closeDoubleQuote: exports.closeDoubleQuote, openSingleQuote: exports.openSingleQuote,
   closeSingleQuote: exports.closeSingleQuote, smartQuotes: exports.smartQuotes, allInputRules: exports.allInputRules} = require("./rules"))
;({wrappingInputRule: exports.wrappingInputRule, textblockTypeInputRule: exports.textblockTypeInputRule,
   blockQuoteRule: exports.blockQuoteRule, orderedListRule: exports.orderedListRule,
   bulletListRule: exports.bulletListRule, codeBlockRule: exports.codeBlockRule, headingRule: exports.headingRule}
  = require("./util"))

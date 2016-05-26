// !! This module defines a plugin for attaching ‘input rules’ to an
// editor, which can react to or transform text typed by the user. It
// also comes with a bunch of default rules that can be enabled in
// this plugin.

export {InputRule, inputRules, InputRules} from "./inputrules"
export {emDash, ellipsis,
        openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote,
        smartQuotes, all} from "./rules"
export {wrappingInputRule, textblockTypeInputRule} from "./util"

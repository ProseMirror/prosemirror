const {InputRule} = require("./inputrules")

// :: InputRule Converts double dashes to an emdash.
const emDash = new InputRule(/--$/, "-", "—")
exports.emDash = emDash
// :: InputRule Converts three dots to an ellipsis character.
const ellipsis = new InputRule(/\.\.\.$/, ".", "…")
exports.ellipsis = ellipsis
// :: InputRule “Smart” opening double quotes.
const openDoubleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, '"', "“")
exports.openDoubleQuote = openDoubleQuote
// :: InputRule “Smart” closing double quotes.
const closeDoubleQuote = new InputRule(/"$/, '"', "”")
exports.closeDoubleQuote = closeDoubleQuote
// :: InputRule “Smart” opening single quotes.
const openSingleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "'", "‘")
exports.openSingleQuote = openSingleQuote
// :: InputRule “Smart” closing single quotes.
const closeSingleQuote = new InputRule(/'$/, "'", "’")
exports.closeSingleQuote = closeSingleQuote

// :: [InputRule] Smart-quote related input rules.
const smartQuotes = [openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote]
exports.smartQuotes = smartQuotes

// :: [InputRule] All schema-independent input rules defined in this module.
const allInputRules = [emDash, ellipsis].concat(smartQuotes)
exports.allInputRules = allInputRules

const nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/

export function isWordChar(ch) {
  return /\w/.test(ch) || ch > "\x80" &&
    (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
}

/**
 * Get the category of a given character. Either a "space",
 * a character that can be part of a word ("word"), or anything else ("other").
 *
 * @param  {string} ch The character.
 * @return {string}
 */
export function charCategory(ch) {
  return /\s/.test(ch) ? "space" : isWordChar(ch) ? "word" : "other"
}

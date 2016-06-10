// !! Defines a parser and serializer for
// [CommonMark](http://commonmark.org/) text (registered in the
// [`format`](#format) module under `"markdown"`).

;({defaultMarkdownParser: exports.defaultMarkdownParser, MarkdownParser: exports.MarkdownParser} = require("./from_markdown"))
;({MarkdownSerializer: exports.MarkdownSerializer, defaultMarkdownSerializer: exports.defaultMarkdownSerializer,
   MarkdownSerializerState: exports.MarkdownSerializerState} = require("./to_markdown"))

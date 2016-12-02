const {Slice, Fragment} = require("prosemirror-model")
const {Transform} = require("prosemirror-transform")

function mutateDoc(options, callback) {
  var doc = options.doc, pos = options.pos, slice = new Slice(Fragment.from(doc.type.schema.text("X")), 0, 0)
  for (var i = 0; i < options.n; i++) {
    var add = new Transform(doc).replace(pos, pos, slice)
    callback(add)
    var rem = new Transform(add.doc).delete(pos, pos + 1)
    callback(rem)
    doc = rem.doc
  }
}
exports.mutateDoc = mutateDoc

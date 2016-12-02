const {Transform} = require("prosemirror-transform")

function typeDoc(options, callback) {
  var example = options.doc, schema = example.type.schema
  var doc = schema.nodes.doc.createAndFill(), pos = 0

  function scan(node, depth) {
    if (node.isText) {
      for (var i = 0; i < node.text.length; i++) {
        var tr = new Transform(doc).replaceRangeWith(pos, pos, schema.text(node.text.charAt(i), node.marks))
        callback(tr)
        doc = tr.doc
        pos++
      }
    } else if (pos < doc.content.size - depth) {
      pos++
      scanContent(node, depth + 1)
      pos++
    } else {
      if (node.isLeaf) {
        var tr = new Transform(doc).replaceRangeWith(pos, pos, node)
        callback(tr)
        doc = tr.doc
        pos += node.nodeSize
      } else {
        var tr = new Transform(doc).replaceRangeWith(pos, pos, node.type.createAndFill())
        callback(tr)
        doc = tr.doc
        pos++
        scanContent(node, depth + 1)
        pos++
      }
    }
  }
  function scanContent(node, depth) {
    node.forEach(child => scan(child, depth))
  }
  scanContent(example, 0)
}
exports.typeDoc = typeDoc

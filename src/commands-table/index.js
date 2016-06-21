const {Fragment, Slice} = require("../model")
const {TableRow, AddColumnStep, RemoveColumnStep} = require("../schema-table")
const {ReplaceStep} = require("../transform")
const {Selection} = require("../edit")

// Table-related command functions

// FIXME this module doesn't depend on the editor module. Do these
// functions which take an editor belong here? Can't express
// moveToNextCell without access to Selection

function findRow($pos, pred) {
  for (let d = $pos.depth; d > 0; d--)
    if ($pos.node(d).type instanceof TableRow && (!pred || pred(d))) return d
  return -1
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column before the column with the
// selection.
function addColumnBefore(pm, apply) {
  let $from = pm.selection.$from, cellFrom
  let rowDepth = findRow($from, d => cellFrom = d == $from.depth ? $from.nodeBefore : $from.node(d + 1))
  if (rowDepth == -1) return false
  if (apply !== false)
    pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth),
                                    cellFrom.type, cellFrom.attrs)).apply()
  return true
}
exports.addColumnBefore = addColumnBefore

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column after the column with the
// selection.
function addColumnAfter(pm, apply) {
  let $from = pm.selection.$from, cellFrom
  let rowDepth = findRow($from, d => cellFrom = d == $from.depth ? $from.nodeAfter : $from.node(d + 1))
  if (rowDepth == -1) return false
  if (apply !== false)
    pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1),
                                    $from.indexAfter(rowDepth) + (rowDepth == $from.depth ? 1 : 0),
                                    cellFrom.type, cellFrom.attrs)).apply()
  return true
}
exports.addColumnAfter = addColumnAfter

// :: (ProseMirror, ?bool) → bool
// Command function that removes the column with the selection.
function removeColumn(pm, apply) {
  let $from = pm.selection.$from
  let rowDepth = findRow($from, d => $from.node(d).childCount > 1)
  if (rowDepth == -1) return false
  if (apply !== false)
    pm.tr.step(RemoveColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth))).apply()
  return true
}
exports.removeColumn = removeColumn

function addRow(pm, apply, side) {
  let $from = pm.selection.$from
  let rowDepth = findRow($from)
  if (rowDepth == -1) return false
  if (apply !== false) {
    let exampleRow = $from.node(rowDepth)
    let cells = [], pos = side < 0 ? $from.before(rowDepth) : $from.after(rowDepth)
    exampleRow.forEach(cell => cells.push(cell.type.createAndFill(cell.attrs)))
    let row = exampleRow.copy(Fragment.from(cells))
    pm.tr.step(new ReplaceStep(pos, pos, new Slice(Fragment.from(row), 0, 0))).apply()
  }
  return true
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row after the row with the
// selection.
function addRowBefore(pm, apply) {
  return addRow(pm, apply, -1)
}
exports.addRowBefore = addRowBefore

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row before the row with the
// selection.
function addRowAfter(pm, apply) {
  return addRow(pm, apply, 1)
}
exports.addRowAfter = addRowAfter

// :: (ProseMirror, ?bool) → bool
// Command function that removes the row with the selection.
function removeRow(pm, apply) {
  let $from = pm.selection.$from
  let rowDepth = findRow($from, d => $from.node(d - 1).childCount > 1)
  if (rowDepth == -1) return false
  if (apply !== false)
    pm.tr.step(new ReplaceStep($from.before(rowDepth), $from.after(rowDepth), Slice.empty)).apply()
  return true
}
exports.removeRow = removeRow

function moveCell(pm, dir, apply) {
  let {$from} = pm.selection
  let rowDepth = findRow($from)
  if (rowDepth == -1) return false
  let row = $from.node(rowDepth), newIndex = $from.index(rowDepth) + dir
  if (newIndex >= 0 && newIndex < row.childCount) {
    let $cellStart = pm.doc.resolve(row.content.offsetAt(newIndex) + $from.start(rowDepth))
    let sel = Selection.findFrom($cellStart, 1)
    if (!sel || sel.from >= $cellStart.end()) return false
    if (apply !== false) pm.setSelection(sel)
    return true
  } else {
    let rowIndex = $from.index(rowDepth - 1) + dir, table = $from.node(rowDepth - 1)
    if (rowIndex < 0 || rowIndex >= table.childCount) return false
    let cellStart = dir > 0 ? $from.after(rowDepth) + 2 : $from.before(rowDepth) - 2 - table.child(rowIndex).lastChild.content.size
    let $cellStart = pm.doc.resolve(cellStart), sel = Selection.findFrom($cellStart, 1)
    if (!sel || sel.from >= $cellStart.end()) return false
    if (apply !== false) pm.setSelection(sel)
    return true
  }
}

// :: (ProseMirror, ?bool) → bool
// Move to the next cell in the current table, if there is one.
function selectNextCell(pm, apply) { return moveCell(pm, 1, apply) }
exports.selectNextCell = selectNextCell

// :: (ProseMirror, ?bool) → bool
// Move to the previous cell in the current table, if there is one.
function selectPreviousCell(pm, apply) { return moveCell(pm, -1, apply) }
exports.selectPreviousCell = selectPreviousCell

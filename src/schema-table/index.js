const {Block, Attribute, Fragment, Slice} = require("../model")
const {Step, StepResult, PosMap} = require("../transform")
const {copyObj} = require("../util/obj")

// ;; A table node type. Has one attribute, **`columns`**, which holds
// a number indicating the amount of columns in the table.
class Table extends Block {
  get attrs() { return {columns: new Attribute({default: 1})} }
  toDOM() { return ["table", ["tbody", 0]] }
  get matchDOMTag() {
    return {"table": dom => {
      let row = dom.querySelector("tr")
      if (!row || !row.children.length) return false
      // FIXME using the child count as column width is problematic
      // when parsing document fragments
      return {columns: row.children.length}
    }}
  }
}
exports.Table = Table

// ;; A table row node type. Has one attribute, **`columns`**, which
// holds a number indicating the amount of columns in the table.
class TableRow extends Block {
  get attrs() { return {columns: new Attribute({default: 1})} }
  toDOM() { return ["tr", 0] }
  get matchDOMTag() {
    return {"tr": dom => dom.children.length ? {columns: dom.children.length} : false}
  }
}
exports.TableRow = TableRow

// ;; A table cell node type.
class TableCell extends Block {
  toDOM() { return ["td", 0] }
  get matchDOMTag() { return {"td": null} }
}
exports.TableCell = TableCell

// :: (OrderedMap, string, ?string) → OrderedMap
// Convenience function for adding table-related node types to a map
// describing the nodes in a schema. Adds `Table` as `"table"`,
// `TableRow` as `"table_row"`, and `TableCell` as `"table_cell"`.
// `cellContent` should be a content expression describing what may
// occur inside cells.
function addTableNodes(nodes, cellContent, tableGroup) {
  return nodes.append({
    table: {type: Table, content: "table_row[columns=.columns]+", group: tableGroup},
    table_row: {type: TableRow, content: "table_cell{.columns}"},
    table_cell: {type: TableCell, content: cellContent}
  })
}
exports.addTableNodes = addTableNodes

// :: (NodeType, number, number, ?Object) → Node
// Create a table node with the given number of rows and columns.
function createTable(nodeType, rows, columns, attrs) {
  attrs = attrs ? copyObj(attrs) : Object.create(null)
  attrs.columns = columns
  let rowType = nodeType.contentExpr.elements[0].nodeTypes[0]
  let cellType = rowType.contentExpr.elements[0].nodeTypes[0]
  let cell = cellType.createAndFill(), cells = []
  for (let i = 0; i < columns; i++) cells.push(cell)
  let row = rowType.create({columns}, Fragment.from(cells)), rowNodes = []
  for (let i = 0; i < rows; i++) rowNodes.push(row)
  return nodeType.create(attrs, Fragment.from(rowNodes))
}
exports.createTable = createTable

// Steps to add and remove a column

function adjustColumns(attrs, diff) {
  let copy = copyObj(attrs)
  copy.columns = attrs.columns + diff
  return copy
}

// ;; A `Step` subclass for adding a column to a table in a single
// atomic step.
class AddColumnStep extends Step {
  constructor(positions, cells) {
    super()
    this.positions = positions
    this.cells = cells
  }

  // :: (Node, number, number, NodeType, ?Object) → AddColumnStep
  // Create a step that inserts a column into the table after
  // `tablePos`, at the index given by `columnIndex`, using cells with
  // the given type and attributes.
  static create(doc, tablePos, columnIndex, cellType, cellAttrs) {
    let cell = cellType.createAndFill(cellAttrs)
    let positions = [], cells = []
    let table = doc.nodeAt(tablePos)
    table.forEach((row, rowOff) => {
      let cellPos = tablePos + 2 + rowOff
      for (let i = 0; i < columnIndex; i++) cellPos += row.child(i).nodeSize
      positions.push(cellPos)
      cells.push(cell)
    })
    return new AddColumnStep(positions, cells)
  }

  apply(doc) {
    let index = null, table = null, tablePos = null
    for (let i = 0; i < this.positions.length; i++) {
      let $pos = doc.resolve(this.positions[i])
      if ($pos.depth < 2 || $pos.index(-1) != i)
        return StepResult.fail("Invalid cell insert position")
      if (table == null) {
        table = $pos.node(-1)
        if (table.childCount != this.positions.length)
          return StepResult.fail("Mismatch in number of rows")
        tablePos = $pos.before(-1)
        index = $pos.index()
      } else if ($pos.before(-1) != tablePos || $pos.index() != index) {
        return StepResult.fail("Column insert positions not consistent")
      }
    }

    let updatedRows = []
    for (let i = 0; i < table.childCount; i++) {
      let row = table.child(i), rowCells = index ? [] : [this.cells[i]]
      for (let j = 0; j < row.childCount; j++) {
        rowCells.push(row.child(j))
        if (j + 1 == index) rowCells.push(this.cells[i])
      }
      updatedRows.push(row.type.create(adjustColumns(row.attrs, 1), Fragment.from(rowCells)))
    }
    let updatedTable = table.type.create(adjustColumns(table.attrs, 1),  Fragment.from(updatedRows))
    return StepResult.fromReplace(doc, tablePos, tablePos + table.nodeSize,
                                  new Slice(Fragment.from(updatedTable), 0, 0))
  }

  posMap() {
    let ranges = []
    for (let i = 0; i < this.positions.length; i++)
      ranges.push(this.positions[i], 0, this.cells[i].nodeSize)
    return new PosMap(ranges)
  }

  invert(doc) {
    let $first = doc.resolve(this.positions[0])
    let table = $first.node(-1)
    let from = [], to = [], dPos = 0
    for (let i = 0; i < table.childCount; i++) {
      let pos = this.positions[i] + dPos, size = this.cells[i].nodeSize
      from.push(pos)
      to.push(pos + size)
      dPos += size
    }
    return new RemoveColumnStep(from, to)
  }

  map(mapping) {
    return new AddColumnStep(this.positions.map(p => mapping.map(p)), this.cells)
  }

  toJSON() {
    return {stepType: this.jsonID,
            positions: this.positions,
            cells: this.cells.map(c => c.toJSON())}
  }

  static fromJSON(schema, json) {
    return new AddColumnStep(json.positions, json.cells.map(schema.nodeFromJSON))
  }
}
exports.AddColumnStep = AddColumnStep

Step.jsonID("addTableColumn", AddColumnStep)

// ;; A subclass of `Step` that removes a column from a table.
class RemoveColumnStep extends Step {
  constructor(from, to) {
    super()
    this.from = from
    this.to = to
  }

  // :: (Node, number, number) → RemoveColumnStep
  // Create a step that deletes the column at `columnIndex` in the
  // table after `tablePos`.
  static create(doc, tablePos, columnIndex) {
    let from = [], to = []
    let table = doc.nodeAt(tablePos)
    table.forEach((row, rowOff) => {
      let cellPos = tablePos + 2 + rowOff
      for (let i = 0; i < columnIndex; i++) cellPos += row.child(i).nodeSize
      from.push(cellPos)
      to.push(cellPos + row.child(columnIndex).nodeSize)
    })
    return new RemoveColumnStep(from, to)
  }

  apply(doc) {
    let index = null, table = null, tablePos = null
    for (let i = 0; i < this.from.length; i++) {
      let $from = doc.resolve(this.from[i]), after = $from.nodeAfter
      if ($from.depth < 2 || $from.index(-1) != i || !after || this.from[i] + after.nodeSize != this.to[i])
        return StepResult.fail("Invalid cell delete positions")
      if (table == null) {
        table = $from.node(-1)
        if (table.childCount != this.from.length)
          return StepResult.fail("Mismatch in number of rows")
        tablePos = $from.before(-1)
        index = $from.index()
      } else if ($from.before(-1) != tablePos || $from.index() != index) {
        return StepResult.fail("Column delete positions not consistent")
      }
    }

    let updatedRows = []
    for (let i = 0; i < table.childCount; i++) {
      let row = table.child(i), rowCells = []
      for (let j = 0; j < row.childCount; j++)
        if (j != index) rowCells.push(row.child(j))
      updatedRows.push(row.type.create(adjustColumns(row.attrs, -1), Fragment.from(rowCells)))
    }
    let updatedTable = table.type.create(adjustColumns(table.attrs, -1),  Fragment.from(updatedRows))
    return StepResult.fromReplace(doc, tablePos, tablePos + table.nodeSize,
                                  new Slice(Fragment.from(updatedTable), 0, 0))
  }

  posMap() {
    let ranges = []
    for (let i = 0; i < this.from.length; i++)
      ranges.push(this.from[i], this.to[i] - this.from[i], 0)
    return new PosMap(ranges)
  }

  invert(doc) {
    let $first = doc.resolve(this.from[0])
    let table = $first.node(-1), index = $first.index()
    let positions = [], cells = [], dPos = 0
    for (let i = 0; i < table.childCount; i++) {
      positions.push(this.from[i] - dPos)
      let cell = table.child(i).child(index)
      dPos += cell.nodeSize
      cells.push(cell)
    }
    return new AddColumnStep(positions, cells)
  }

  map(mapping) {
    let from = [], to = []
    for (let i = 0; i < this.from.length; i++) {
      let start = mapping.map(this.from[i], 1), end = mapping.map(this.to[i], -1)
      if (end <= start) return null
      from.push(start)
      to.push(end)
    }
    return new RemoveColumnStep(from, to)
  }

  static fromJSON(_schema, json) {
    return new RemoveColumnStep(json.from, json.to)
  }
}
exports.RemoveColumnStep = RemoveColumnStep

Step.jsonID("removeTableColumn", RemoveColumnStep)

var ProseMirror = require("../dist/edit").ProseMirror
var fromDOM = require("../dist/htmlformat").fromDOM
var schema = require("../dist/schema").defaultSchema
var inputRules = require("../dist/inputrules")
var defaultRules = require("../dist/schema/inputrules").defaultRules
var menuBar = require("../dist/menu/menubar").menuBar
var menu = require("../dist/menu/menu")
var tooltipMenu = require("../dist/menu/tooltipmenu").tooltipMenu

var menuContent = [[menu.joinUpItem, menu.liftItem],
                   [menu.selectParentNodeItem],
                   [menu.undoItem, menu.redoItem]]

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: fromDOM(schema, document.querySelector("#content")),
  schema: schema,
  plugins: [menuBar.config({float: true, content: menuContent}),
            tooltipMenu.config({selectedBlockMenu: true,
                                inlineContent: [],
                                blockContent: [[menu.joinUpItem, menu.liftItem], [menu.selectParentNodeItem]]}),
            inputRules.inputRules.config({rules: inputRules.all.concat(defaultRules)})]
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

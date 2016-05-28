var ProseMirror = require("../dist/edit").ProseMirror
var fromDOM = require("../dist/htmlformat").fromDOM
var schema = require("../dist/schema").defaultSchema
var inputRules = require("../dist/inputrules")
var defaultRules = require("../dist/schema/inputrules").defaultRules
var menuBar = require("../dist/menu/menubar").menuBar
var tooltipMenu = require("../dist/menu/tooltipmenu").tooltipMenu
var schemaMenu = require("../dist/schema/menu")
var schemaKeys = require("../dist/schema/commands")

var menu = schemaMenu.defaultMenuItems(schema)

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: fromDOM(schema, document.querySelector("#content")),
  schema: schema,
  plugins: [menuBar.config({float: true, content: menu.fullMenu}),
            tooltipMenu.config({selectedBlockMenu: true,
                                inlineContent: menu.inlineMenu,
                                blockContent: menu.blockMenu}),
            inputRules.inputRules.config({rules: inputRules.all.concat(defaultRules)}),
            schemaKeys.addSchemaKeys]
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

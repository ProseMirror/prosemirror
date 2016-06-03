var ProseMirror = require("../src/edit").ProseMirror
var fromDOM = require("../src/htmlformat").fromDOM
var schema = require("../src/schema").defaultSchema
var inputRules = require("../src/inputrules")
var defaultRules = require("../src/schema/inputrules").defaultRules
var menuBar = require("../src/menu/menubar").menuBar
var tooltipMenu = require("../src/menu/tooltipmenu").tooltipMenu
var schemaMenu = require("../src/schema/menu")
var schemaKeys = require("../src/schema/keymap")
var defaultStyle = require("../src/schema/style").defaultSchemaStyle

var menu = schemaMenu.defaultMenuItems(schema)

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: fromDOM(schema, document.querySelector("#content")),
  schema: schema,
  plugins: [menuBar.config({float: true, content: menu.fullMenu}),
            tooltipMenu.config({selectedBlockMenu: true,
                                inlineContent: menu.inlineMenu,
                                blockContent: menu.blockMenu}),
            inputRules.inputRules.config({rules: inputRules.all.concat(defaultRules(schema))}),
            schemaKeys.defaultSchemaKeymapPlugin,
            defaultStyle]
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

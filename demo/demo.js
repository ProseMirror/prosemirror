var ProseMirror = require("../src/edit").ProseMirror
var fromDOM = require("../src/htmlformat").fromDOM
var schema = require("../src/schema").defaultSchema
var tooltipMenu = require("../src/menu/tooltipmenu").tooltipMenu
var schemaMenu = require("../src/schema/menu")
var defaultSetup = require("../src/schema/defaultsetup").defaultSetup

var menu = schemaMenu.defaultMenuItems(schema)

var pm = window.pm = new ProseMirror({
  place: document.querySelector(".full"),
  doc: fromDOM(schema, document.querySelector("#content")),
  plugins: [tooltipMenu.config({selectedBlockMenu: true,
                                inlineContent: menu.inlineMenu,
                                blockContent: menu.blockMenu}),
            defaultSetup]
})

document.querySelector("#mark").addEventListener("mousedown", function(e) {
  pm.markRange(pm.selection.from, pm.selection.to, {className: "marked"})
  e.preventDefault()
})

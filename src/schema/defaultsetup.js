const {Plugin} = require("../edit")
const {menuBar} = require("../menu/menubar")
const {inputRules, allInputRules} = require("../inputrules")
const {defaultRules} = require("./inputrules")
const {defaultMenuItems} = require("./menu")
const {defaultSchemaKeymapPlugin} = require("./keymap")
const {defaultSchemaStyle} = require("./style")

// :: Plugin
// A convenience plugin that bundles together a simple menubar, the
// default input rules, default key bindings, and default styling.
// Probably only useful for quickly setting up a passable
// editor—you'll need more control over your settings in most
// real-world situations.
const defaultSetup = new Plugin(class DefaultSetup {
  constructor(pm, options) {
    let menu = options.menu
    if (menu == null)
      menu = defaultMenuItems(pm.schema).fullMenu

    this.plugins = (menu ? [menuBar.config({float: true, content: menu})] : []).concat([
      inputRules.config({rules: allInputRules.concat(defaultRules(pm.schema))}),
      defaultSchemaKeymapPlugin,
      defaultSchemaStyle
    ])
    this.plugins.forEach(plugin => plugin.attach(pm))
  }

  detach(pm) {
    this.plugins.forEach(plugin => plugin.detach(pm))
  }
})
exports.defaultSetup = defaultSetup

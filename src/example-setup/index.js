const {blockQuoteRule, orderedListRule, bulletListRule, codeBlockRule, headingRule,
       inputRules, allInputRules} = require("../inputrules")
const {BlockQuote, OrderedList, BulletList, CodeBlock, Heading} = require("../schema-basic")
const {Plugin} = require("../edit")
const {menuBar, tooltipMenu} = require("../menu")

const {className} = require("./style")
const {buildMenuItems} = require("./menu")
exports.buildMenuItems = buildMenuItems
const {buildKeymap} = require("./keymap")
exports.buildKeymap = buildKeymap

// !! This module exports helper functions for deriving a set of basic
// menu items, input rules, or key bindings from a schema. These
// values need to know about the schema for two reasons—they need
// access to specific instances of node and mark types, and they need
// to know which of the node and mark types that they know about are
// actually present in the schema.
//
// The `exampleSetup` plugin ties these together into a plugin that
// will automatically enable this basic functionality in an editor.

// :: Plugin
// A convenience plugin that bundles together a simple menu with basic
// key bindings, input rules, and styling for the example schema.
// Probably only useful for quickly setting up a passable
// editor—you'll need more control over your settings in most
// real-world situations. The following options are recognized:
//
// **`menuBar`**`: union<bool, Object> = true`
//   : Enable or configure the menu bar. `false` turns it off, `true`
//     enables it with the default options, and passing an object will
//     pass that value on as the options for the menu bar.
//
// **`tooltipMenu`**`: union<bool, Object> = false`
//   : Enable or configure the tooltip menu. Interpreted the same way
//     as `menuBar`.
//
// **`mapKeys`**: ?Object = null`
//   : Can be used to [adjust](#buildKeymap) the key bindings created.
exports.exampleSetup = new Plugin(class {
  constructor(pm, options) {
    pm.wrapper.classList.add(className)
    this.keymap = buildKeymap(pm.schema, options.mapKeys)
    pm.addKeymap(this.keymap)
    this.inputRules = allInputRules.concat(buildInputRules(pm.schema))
    let rules = inputRules.ensure(pm)
    this.inputRules.forEach(rule => rules.addRule(rule))

    let builtMenu
    this.barConf = options.menuBar
    this.tooltipConf = options.tooltipMenu

    if (this.barConf === true) {
      builtMenu = buildMenuItems(pm.schema)
      this.barConf = {float: true, content: builtMenu.fullMenu}
    }
    if (this.barConf) menuBar.config(this.barConf).attach(pm)

    if (this.tooltipConf === true) {
      if (!builtMenu) builtMenu = buildMenuItems(pm.schema)
      this.tooltipConf = {selectedBlockMenu: true,
                          inlineContent: builtMenu.inlineMenu,
                          blockContent: builtMenu.blockMenu}
    }
    if (this.tooltipConf) tooltipMenu.config(this.tooltipConf).attach(pm)
  }
  detach(pm) {
    pm.wrapper.classList.remove(className)
    pm.removeKeymap(this.keymap)
    let rules = inputRules.ensure(pm)
    this.inputRules.forEach(rule => rules.removeRule(rule))
    if (this.barConf) menuBar.detach(pm)
    if (this.tooltipConf) tooltipMenu.detach(pm)
  }
}, {
  menuBar: true,
  tooltipMenu: false,
  mapKeys: null
})

// :: (Schema) → [InputRule]
// A set of input rules for creating the basic block quotes, lists,
// code blocks, and heading.
function buildInputRules(schema) {
  let result = []
  for (let name in schema.nodes) {
    let node = schema.nodes[name]
    if (node instanceof BlockQuote) result.push(blockQuoteRule(node))
    if (node instanceof OrderedList) result.push(orderedListRule(node))
    if (node instanceof BulletList) result.push(bulletListRule(node))
    if (node instanceof CodeBlock) result.push(codeBlockRule(node))
    if (node instanceof Heading) result.push(headingRule(node, 6))
  }
  return result
}
exports.buildInputRules = buildInputRules

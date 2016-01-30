import {insertCSS} from "../dom"
import {MenuCommandGroup, Dropdown, DropdownSubmenu} from "./menu"

export const inlineGroup = new MenuCommandGroup("inline")
export const insertMenu = new Dropdown({display: "Insert"}, new MenuCommandGroup("insert"))
export const textblockMenu = new Dropdown(
  {display: "Type..", displayActive: true, class: "ProseMirror-textblock-dropdown"},
  [new MenuCommandGroup("textblock"),
   new DropdownSubmenu({label: "Heading"}, new MenuCommandGroup("textblockHeading"))]
)
export const blockGroup = new MenuCommandGroup("block")
export const historyGroup = new MenuCommandGroup("history")

insertCSS(`
.ProseMirror-textblock-dropdown {
  min-width: 3em;
}
`)

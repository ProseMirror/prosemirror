import {elt} from "../edit/dom"
import {Dialog} from "./menuitem"

import "./tooltip-menu.css"
const prefix = "ProseMirror-tooltip-menu"

export function openMenu(tooltip, items, pm, where) {
  showItems(tooltip, items.filter(i => i.select(pm)), pm, where)
}

function showItems(tooltip, items, pm, where) {
  if (items.length == 0) {
    tooltip.close()
    return
  }

  let dom = elt("ul", {class: prefix})
  items.forEach(item => {
    let iconClass = "ProseMirror-icon ProseMirror-icon-" + item.icon
    let maybeActive = item.active(pm) ? prefix + "-active" : null
    let li = dom.appendChild(elt("li", {title: item.title, class: maybeActive},
                                 elt("span", {class: iconClass})))
    li.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      itemClicked(tooltip, item, pm)
    })
  })

  let id = "menu-" + items.map(i => i.icon).join("-")
  tooltip.show(id, dom, where)
}

function chainResult(tooltip, result, pm) {
  if (Array.isArray(result))
    showItems(tooltip, result, pm)
  else if (result instanceof Dialog)
    showDialog(tooltip, result, pm)
  else if (tooltip.reset)
    tooltip.reset()
  else
    tooltip.close()
}

function itemClicked(tooltip, item, pm) {
  chainResult(tooltip, item.apply(pm), pm)
}

function showDialog(tooltip, dialog, pm) {
  tooltip.active = true

  function finish() {
    tooltip.active = false
    pm.focus()
  }

  let form = dialog.buildForm(pm)
  form.addEventListener("submit", e => {
    e.preventDefault()
    let result = dialog.apply(form, pm)
    finish()
    chainResult(tooltip, result, pm)
  })
  form.addEventListener("keydown", e => {
    if (e.keyCode == 27) {
      finish()
      if (tooltip.reset) tooltip.reset()
      else tooltip.close()
    }
  })
  tooltip.show(dialog.id, form)
  dialog.focus(form)
}

// Awkward hack to force Chrome to initialize the font and not return
// incorrect size information the first time it is used.

let forced = false

export function forceFontLoad(pm) {
  if (forced) return
  forced = true

  let node = pm.wrapper.appendChild(elt("div", {class: "ProseMirror-icon ProseMirror-icon-bold",
                                                style: "visibility: hidden; position: absolute"}))
  window.setTimeout(() => pm.wrapper.removeChild(node), 20)
}

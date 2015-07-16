import {elt} from "../dom"
import {Dialog} from "./menuitem"
import insertCSS from "insert-css"

const prefix = "ProseMirror-tooltip-menu"

class Wrapper {
  constructor(node) { this.node = node }
  close() { this.node.textContent = "" }
  show(_id, dom) { this.close(); this.node.appendChild(dom) }
}

export function openMenu(container, items, pm, where) {
  if (container.nodeType) container = new Wrapper(container)
  showItems(container, items.filter(i => i.select(pm)), pm, where)
}

function showItems(container, items, pm, where) {
  if (items.length == 0) {
    container.close()
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
      itemClicked(container, item, pm)
    })
  })

  let id = "menu-" + items.map(i => i.icon).join("-")
  container.show(id, dom, where)
}

function chainResult(container, result, pm) {
  if (Array.isArray(result)) {
    container.active++
    showItems(container, result, pm)
  } else if (result instanceof Dialog) {
    showDialog(container, result, pm)
  } else if (container.reset) {
    container.reset()
  } else {
    container.close()
  }
}

function itemClicked(container, item, pm) {
  chainResult(container, item.apply(pm), pm)
}

function showDialog(container, dialog, pm) {
  let done = false
  container.active++

  function finish() {
    if (!done) {
      done = true
      container.active--
      pm.focus()
    }
  }

  function submit() {
    let result = dialog.apply(form, pm)
    finish()
    chainResult(container, result, pm)
  }
  let form = dialog.buildForm(pm, submit)
  form.addEventListener("submit", e => {
    e.preventDefault()
    submit()
  })
  form.addEventListener("keydown", e => {
    if (e.keyCode == 27) {
      finish()
      if (container.reset) container.reset()
      else container.close()
    } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault()
      submit()
    }
  })
  container.show(dialog.id, form)
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

insertCSS(`

.ProseMirror-tooltip-menu {
  padding: 0;
  margin: 0 -4px;
  display: block;
  line-height: 1;
  white-space: pre;
  width: -webkit-fit-content;
  width: fit-content;
}

.ProseMirror-tooltip-menu li {
  display: inline-block;
  padding: 2px 7px;
  margin: 0 2px;
  cursor: pointer;
}

.ProseMirror-tooltip-menu-active {
  background: #666;
  border-radius: 4px;
}

`)

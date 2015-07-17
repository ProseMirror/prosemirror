import {elt} from "../dom"
import {Dialog, Item} from "./menuitem"
import insertCSS from "insert-css"

const prefix = "ProseMirror-menu"

export class Menu {
  constructor(pm, place, resetFunc) {
    this.pm = pm
    this.place = place
    this.resetFunc = resetFunc || (() => {})
    this.stack = []
  }

  reset() {
    this.stack.length = 0
    this.resetFunc()
  }

  get active() { return this.stack.length > 1 }

  show(dom, id, info) {
    if (this.place.nodeType) {
      this.place.textContent = ""
      this.place.appendChild(dom)
    } else {
      this.place(dom, id, info)
    }
  }

  open(items, info) {
    this.stack.length = 0
    this.showItems(items.filter(i => i.select(this.pm)), info)
  }
  showItems(items, info) {
    if (items.length == 0) {
      this.reset()
      return
    }

    this.stack.push(items)
    let dom = elt("ul", {class: prefix})
    items.forEach(item => {
      let iconClass = "ProseMirror-icon ProseMirror-icon-" + item.icon
      let maybeActive = item.active(this.pm) ? prefix + "-active" : null
      let li = dom.appendChild(elt("li", {title: item.title, class: maybeActive},
                                   elt("span", {class: iconClass})))
      li.addEventListener("mousedown", e => {
        e.preventDefault(); e.stopPropagation()
        this.enter(item.apply(this.pm))
      })
    })

    let id = "menu-" + items.map(i => i.icon).join("-")
    this.show(dom, id, info)
  }

  enter(result) {
    if (Array.isArray(result) && result.length) {
      if (this.stack.length) result = [new BackItem(this)].concat(result)
      this.showItems(result)
    } else if (result instanceof Dialog) {
      this.showDialog(result)
    } else {
      this.reset()
    }
  }

  showDialog(dialog) {
    this.stack.push(dialog)
    let done = false

    let finish = () => {
      if (!done) {
        done = true
        this.pm.focus()
      }
    }

    let submit = () => {
      let result = dialog.apply(form, this.pm)
      finish()
      this.enter(result)
    }
    let form = dialog.buildForm(this.pm, submit)
    form.addEventListener("submit", e => {
      e.preventDefault()
      submit()
    })
    form.addEventListener("keydown", e => {
      if (e.keyCode == 27) {
        finish()
        this.stack.pop()
        this.enter(this.stack.pop())
      } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault()
        submit()
      }
    })
    this.show(form, dialog.id)
    dialog.focus(form)
  }

  static fromTooltip(pm, tooltip, reset) {
    return new Menu(pm, (dom, id, pos) => tooltip.show(id, dom, pos),
                    reset || (() => tooltip.close()))
  }
}

export class BackItem extends Item {
  constructor(menu) {
    super("laquo", "Back")
    this.menu = menu
  }
  apply() {
    this.menu.stack.pop()
    return this.menu.stack.pop()
  }
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

.ProseMirror-menu {
  padding: 0;
  margin: 0 -4px;
  display: block;
  line-height: 1;
  white-space: pre;
  width: -webkit-fit-content;
  width: fit-content;
}

.ProseMirror-menu li {
  display: inline-block;
  padding: 2px 7px;
  margin: 0 2px;
  cursor: pointer;
}

.ProseMirror-menu-active {
  background: #666;
  border-radius: 4px;
}

`)

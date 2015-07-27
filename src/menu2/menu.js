import {elt} from "../dom"
import insertCSS from "insert-css"

export class Menu {
  constructor(pm, display) {
    this.display = display
    this.stack = []
    this.pm = pm
  }

  show(content, displayInfo) {
    this.stack.length = 0
    this.enter(content, displayInfo)
  }

  reset() {
    this.stack.length = 0
    this.display.reset()
  }

  enter(content, displayInfo) {
    let selected = content.map(i => i.select(this.pm))
    if (!selected.length) return this.display.clear()

    this.stack.push(content)
    this.draw(displayInfo)
  }

  get active() {
    return this.stack.length > 1
  }

  draw(displayInfo) {
    let cur = this.stack[this.stack.length - 1]
    let rendered = elt("div", {class: "ProseMirror-menu"}, cur.map(item => item.render(this)))
    if (this.stack.length > 1)
      this.display.enter(rendered, () => this.leave(), displayInfo)
    else
      this.display.show(rendered, displayInfo)
  }

  run(content) {
    if (!content) return this.reset()
    else this.enter(content)
  }

  leave() {
    this.stack.pop()
    if (this.stack.length)
      this.draw()
    else
      this.display.reset()
  }
}

export class TooltipDisplay {
  constructor(tooltip, resetFunc) {
    this.tooltip = tooltip
    this.resetFunc = resetFunc
  }

  clear() {
    this.tooltip.close()
  }

  reset() {
    if (this.resetFunc) this.resetFunc()
    else this.clear()
  }

  show(dom, info) {
    this.tooltip.open(dom, info)
  }

  enter(dom, back, info) {
    let button = elt("div", {class: "ProseMirror-tooltip-back", title: "Back"})
    button.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      back()
    })
    this.show(elt("div", null, dom, button), info)
  }
}

export class MenuItem {
  select() { return true }
  render() { throw new Error("You have to implement this") }
}

insertCSS(`

.ProseMirror-menu {
  margin: 0 -4px;
  line-height: 1;
  white-space: pre;
  width: -webkit-fit-content;
  width: fit-content;
}

.ProseMirror-tooltip-back {
  line-height: .5;
}
.ProseMirror-tooltip-back:after {
  content: "⌄";
}

`)

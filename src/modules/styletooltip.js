import {defineOption} from "../edit"
import {style, inline} from "../model"
import {elt} from "../edit/dom"

import "./styletooltip.css"

defineOption("styleTooltip", false, function(pm, value) {
  if (pm.mod.styleTooltip)
    pm.mod.styleTooltip.detach()
  if (value)
    pm.mod.styleTooltip = new StyleTooltip(pm, value)
})

const classPrefix = "prosemirror-styletooltip"

const defaultButtons = [
  {type: "strong", title: "Strong text", style: () => style.strong},
  {type: "em", title: "Italic text", style: () => style.em},
  {type: "link", title: "Hyperlink", style: linkDialog},
  {type: "code", title: "Code font", style: () => style.code}
]

class StyleTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.buttons = config === true ? defaultButtons : config
    this.buildTooltip()
    this.pending = null
    this.setting = false

    pm.on("selectionChange", this.update = this.update.bind(this))
    pm.on("change", this.update)
    pm.on("resize", this.resized = this.resized.bind(this))
  }

  detach() {
    window.clearTimeout(this.pending)
    this.pm.mod.styleTooltip = null
    this.menu.parentNode.removeChild(this.menu)
    this.pm.off("selectionChange", this.update)
    this.pm.off("change", this.update)
    this.pm.off("resize", this.resized)
  }

  update() {
    if (this.setting) return
    this.closeTooltip()
    window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => {
      let sel = this.pm.selection
      if (!sel.empty) this.openTooltip()
    }, 200)
  }

  resized() {
    this.closeTooltip()
  }

  buildTooltip() {
    let node = this.menu = elt("ul", {class: classPrefix})
    this.buttons.forEach(button => {
      let cls = classPrefix + "-icon " + classPrefix + "-" + button.type
      let li = node.appendChild(elt("li", null, elt("span", {class: cls})))
      li.addEventListener("mousedown", () => this.buttonClicked(button))
    })
    this.pointer = node.appendChild(elt("div", {class: classPrefix + "-pointer"}))
    node.addEventListener("mousedown", e => e.preventDefault())
    this.pm.wrapper.appendChild(node)
  }

  isActive(button) {
    let sel = this.pm.selection
    return inline.rangeHasInlineStyle(this.pm.doc, sel.from, sel.to, button.type)
  }

  closeTooltip() {
    this.menu.style.visibility = ""
  }

  updateActiveStyles() {
    for (let i = 0; i < this.buttons.length; i++) {
      let button = this.buttons[i], li = this.menu.childNodes[i]
      li.className = this.isActive(button) ? "prosemirror-styletooltip-active" : ""
    }
  }

  openTooltip() {
    let width = this.menu.offsetWidth, height = this.menu.offsetHeight
    let pointerWidth = this.pointer.offsetWidth
    this.updateActiveStyles()
    let {top, left} = topCenterOfSelection()
    let pointerLeft = (width - pointerWidth) / 2
    left -= width / 2
    if (left < 0) {
      pointerLeft += left
      left = 0
    } else if (left + width > window.innerWidth) {
      pointerLeft += left + width - window.innerWidth
      left = window.innerWidth - width
    }
    
    this.menu.style.top = Math.max(0, top - 10 - height) + "px"
    this.menu.style.left = left + "px"
    this.menu.style.visibility = "visible"
    this.pointer.style.left = pointerLeft + "px"
  }

  buttonClicked(button) {
    let sel = this.pm.selection
    this.setting = true
    if (this.isActive(button))
      this.pm.apply({name: "removeStyle", pos: sel.from, end: sel.to, style: button.type})
    else
      this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: button.style(this.pm)})
    this.setting = false
    this.updateActiveStyles()
  }
}

function linkDialog(pm) {
  return style.link(prompt("Link to", "http://")) // FIXME
}

function topCenterOfSelection() {
  let rects = window.getSelection().getRangeAt(0).getClientRects()
  let {left, right, top} = rects[0]
  for (let i = 1; i < rects.length; i++) {
    if (rects[i].top < rects[0].bottom - 1 &&
        // Chrome bug where bogus rectangles are inserted at span boundaries
        (i == rects.length - 1 || rects[i + 1].left != rects[i].left)) {
      left = Math.min(left, rects[i].left)
      right = Math.max(right, rects[i].right)
      top = Math.min(top, rects[i].top)
    }
  }
  return {top, left: (left + right) / 2}
}

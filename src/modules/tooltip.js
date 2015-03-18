import {elt} from "../edit/dom"
import "./tooltip.css"

const prefix = "ProseMirror-tooltip"

export class MeasuredElement {
  constructor(pm, dom) {
    this.dom = dom
    let testElt = pm.wrapper.appendChild(elt("div", {class: prefix}, dom))
    testElt.style.visibility = "hidden"
    testElt.style.display = "block"
    this.width = testElt.offsetWidth
    this.height = testElt.offsetHeight
    pm.wrapper.removeChild(testElt)
  }
}

export class Tooltip {
  constructor(pm) {
    this.pm = pm
    this.pointer = pm.wrapper.appendChild(elt("div", {class: prefix + "-pointer"}))
    this.pointerWidth = this.pointerHeight = null
    this.dom = pm.wrapper.appendChild(elt("div", {class: prefix}))
    // Prevent clicks on the tooltip from clearing editor selection
    this.dom.addEventListener("mousedown", e => { if (!this.active) e.preventDefault() })
    this.active = false
    this.lastLeft = this.lastRight = null

    pm.on("change", this.updateFunc = () => { if (!this.active) this.close() })
    pm.on("resize", this.updateFunc)
    pm.wrapper.addEventListener("mousedown", this.mouseFunc = e => {
      if (!this.dom.contains(e.target) && pm.wrapper.contains(e.target))
        this.close()
    })
  }

  detach() {
    this.dom.parentNode.removeChild(this.dom)
    this.pointer.parentNode.removeChild(this.pointer)
    pm.off("change", this.updateFunc)
    pm.off("resize", this.updateFunc)
    pm.wrapper.removeEventListener("mousedown", this.mouseFunc)
  }

  show(me, left, top) {
    if (left == null) left = this.lastLeft
    else this.lastLeft = left
    if (top == null) top = this.lastTop
    else this.lastTop = top

    // FIXME do something if top < 0

    let leftPos = left - me.width / 2
    let pointerMid = me.width / 2
    if (leftPos < 0) {
      pointerMid += leftPos
      leftPos = 0
    } else if (leftPos + me.width > window.innerWidth) {
      pointerMid += leftPos + me.width - window.innerWidth
      leftPos = window.innerWidth - me.width
    }

    let around = this.pm.wrapper.getBoundingClientRect()

    for (let child = this.dom.firstChild, next; child; child = next) {
      next = child.nextSibling
      if (child != this.pointer) this.dom.removeChild(child)
    }
    this.dom.appendChild(me.dom)
    this.dom.style.display = this.pointer.style.display = "block"

    if (this.pointerWidth == null) {
      this.pointerWidth = this.pointer.offsetWidth
      this.pointerHeight = this.pointer.offsetHeight
    }

    this.dom.style.width = me.width + "px"
    this.dom.style.height = me.height + "px"
    let finalLeft = leftPos - around.left
    this.dom.style.left = finalLeft + "px"
    let finalTop = top - around.top - 5 - this.pointerHeight - me.height
    this.dom.style.top = finalTop + "px"
    this.pointer.style.top = (finalTop + me.height) + "px"
    this.pointer.style.left = (finalLeft + pointerMid - this.pointerWidth / 2) + "px"
  }

  close() {
    this.dom.style.display = this.pointer.style.display = ""
    this.active = false
  }
}

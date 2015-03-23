import {elt} from "../edit/dom"
import "./tooltip.css"

const prefix = "ProseMirror-tooltip"

export class Tooltip {
  constructor(pm) {
    this.pm = pm
    this.knownSizes = Object.create(null)
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

  getSize(type) {
    let known = this.knownSizes[type]
    if (!known) {
      let unhide = this.dom.style.display != "block"
      if (unhide) this.dom.style.display = "block"
      known = this.knownSizes[type] = {width: this.dom.offsetWidth, height: this.dom.offsetHeight}
      if (unhide) this.dom.style.display = ""
    }
    return known
  }

  show(type, node, left, top) {
    if (left == null) left = this.lastLeft
    else this.lastLeft = left
    if (top == null) top = this.lastTop
    else this.lastTop = top

    for (let child = this.dom.firstChild, next; child; child = next) {
      next = child.nextSibling
      if (child != this.pointer) this.dom.removeChild(child)
    }
    this.dom.appendChild(node)

    let size = this.getSize(type)

    // FIXME do something if top < 0
    let leftPos = left - size.width / 2
    let pointerMid = size.width / 2
    if (leftPos < 0) {
      pointerMid += leftPos
      leftPos = 0
    } else if (leftPos + size.width > window.innerWidth) {
      pointerMid += leftPos + size.width - window.innerWidth
      leftPos = window.innerWidth - size.width
    }

    let around = this.pm.wrapper.getBoundingClientRect()
    this.dom.style.display = this.pointer.style.display = "block"

    if (this.pointerWidth == null) {
      this.pointerWidth = this.pointer.offsetWidth
      this.pointerHeight = this.pointer.offsetHeight
    }

    this.dom.style.width = size.width + "px"
    this.dom.style.height = size.height + "px"
    let finalLeft = leftPos - around.left
    this.dom.style.left = finalLeft + "px"
    let finalTop = top - around.top - 5 - this.pointerHeight - size.height
    this.dom.style.top = finalTop + "px"
    this.pointer.style.top = (finalTop + size.height) + "px"
    this.pointer.style.left = (finalLeft + pointerMid - this.pointerWidth / 2) + "px"
  }

  close() {
    this.dom.style.display = this.pointer.style.display = ""
    this.active = false
  }
}

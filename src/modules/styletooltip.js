import {defineOption} from "../edit"
import {style, inline} from "../model"
import {elt} from "../edit/dom"
import {MeasuredElement, Tooltip} from "./tooltip"

import "./styletooltip.css"

const classPrefix = "ProseMirror-styletooltip"

defineOption("styleTooltip", false, function(pm, value) {
  if (pm.mod.styleTooltip)
    pm.mod.styleTooltip.detach()
  if (value)
    pm.mod.styleTooltip = new StyleTooltip(pm, value)
})

class Form {
  constructor(pm) {
    this.form = this.build()
    this.prepared = new MeasuredElement(pm, this.form)
  }
  showDialog(tooltip, callback) {
    tooltip.show(this.prepared)
    this.init()
    this.form.onsubmit = e => {
      e.preventDefault()
      callback(this.read())
    }
    this.form.onkeydown = e => {
      if (e.keyCode == 27) callback(null)
    }
  }
  init() {}
}

class LinkForm extends Form {
  build() {
    return elt("form", {class: classPrefix + "-link-form", action: "."},
               elt("div", null, elt("input", {name: "href", type: "text", placeholder: "Target URL",
                                              size: 40})),
               elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title", size: 40}),
                   elt("button", {type: "submit", style: "display: none"})))
  }

  init() {
    this.form.elements.href.value =
      this.form.elements.title.value = ""
    this.form.elements.href.focus()
  }

  read() {
    let elts = this.form.elements
    if (!elts.href.value) return null
    return style.link(elts.href.value, elts.title.value)
  }
}

const defaultButtons = [
  {type: "strong", title: "Strong text", style: style.strong},
  {type: "em", title: "Emphasized text", style: style.em},
  {type: "link", title: "Hyperlink", form: LinkForm},
  {type: "code", title: "Code font", style: style.code}
]

class StyleTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.buttons = config === true ? defaultButtons : config
    this.forms = this.buttons.map(b => b.form && new b.form(this.pm))
    this.pending = null

    this.dom = this.buildDOM()
    this.tooltip = new Tooltip(pm)

    pm.on("selectionChange", this.updateFunc = () => this.update())
  }

  detach() {
    this.tooltip.detach()
    
    pm.off("selectionChange", this.updateFunc)
  }

  update() {
    window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => {
      let sel = this.pm.selection
      if (sel.empty || !this.pm.hasFocus()) this.tooltip.close()
      else this.showTooltip()
    }, 100)
  }

  buildDOM() {
    let dom = elt("ul", {class: classPrefix})
    this.buttons.forEach(button => {
      let cls = classPrefix + "-icon " + classPrefix + "-" + button.type
      let li = dom.appendChild(elt("li", {title: button.title}, elt("span", {class: cls})))
      li.addEventListener("mousedown", e => { e.preventDefault(); this.buttonClicked(button) })
    })
    return new MeasuredElement(this.pm, dom)
  }

  isActive(button) {
    let sel = this.pm.selection
    return inline.rangeHasInlineStyle(this.pm.doc, sel.from, sel.to, button.type)
  }

  updateActiveStyles() {
    for (let i = 0; i < this.buttons.length; i++) {
      let button = this.buttons[i]
      let li = this.dom.dom.childNodes[i]
      li.className = this.isActive(button) ? classPrefix + "-active" : ""
    }
  }

  showTooltip() {
    this.updateActiveStyles()
    let {top, left} = topCenterOfSelection()
    this.tooltip.show(this.dom, left, top)
  }

  buttonClicked(button) {
    let sel = this.pm.selection
    this.tooltip.active = true
    let done = () => {
      this.tooltip.active = false
      this.updateActiveStyles()
    }

    if (this.isActive(button)) {
      this.pm.apply({name: "removeStyle", pos: sel.from, end: sel.to, style: button.type})
      done()
    } else if (button.style) {
      this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: button.style})
      done()
    } else {
      this.forms[this.buttons.indexOf(button)].showDialog(this.tooltip, st => {
        if (st)
          this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: st})
        this.tooltip.show(this.dom)
        this.pm.focus()
        done()
      })
    }
  }
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

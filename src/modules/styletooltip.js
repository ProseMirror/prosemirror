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

const defaultButtons = [
  {type: "strong", title: "Strong text", style: style.strong},
  {type: "em", title: "Italic text", style: style.em},
  {type: "link", title: "Hyperlink", style: linkDialog, prepare: prepareLinkDialog},
  {type: "code", title: "Code font", style: style.code}
]

class StyleTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.buttons = config === true ? defaultButtons : config
    this.prepared = this.buttons.map(b => b.prepare && b.prepare(pm))
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
      let li = dom.appendChild(elt("li", null, elt("span", {class: cls})))
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
    } else if (!(button.style instanceof Function)) {
      this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: button.style})
      done()
    } else {
      button.style(this.pm, this.tooltip, this.prepared[this.buttons.indexOf(button)], st => {
        if (st)
          this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: st})
        this.tooltip.show(this.dom)
        this.pm.focus()
        done()
      })
    }
  }
}

function prepareLinkDialog(pm) {
  let form =  elt("form", {class: classPrefix + "-link-form", action: "."},
                  elt("div", null, elt("input", {name: "href", type: "text", placeholder: "Target URL",
                                                 size: 40})),
                  elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title", size: 40}),
                      elt("button", {type: "submit", style: "display: none"})))
  return new MeasuredElement(pm, form)
}

function linkDialog(pm, tooltip, dom, done) {
  tooltip.show(dom)
  let elts = dom.dom.elements
  dom.dom.onsubmit = e => {
    e.preventDefault()
    if (elts.href.value) done(style.link(elts.href.value, elts.title.value))
  }
  dom.dom.onkeydown = e => {
    if (e.keyCode == 27) done(null)
  }
  elts.href.value = elts.title.value = ""
  elts.href.focus()
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

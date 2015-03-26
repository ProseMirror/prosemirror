import {defineOption} from "../edit"
import {style, inline} from "../model"
import {elt} from "../edit/dom"
import {Tooltip} from "./tooltip"

import "./inlinetooltip.css"

const classPrefix = "ProseMirror-inlinetooltip"

defineOption("inlineTooltip", false, function(pm, value) {
  if (pm.mod.inlineTooltip)
    pm.mod.inlineTooltip.detach()
  if (value)
    pm.mod.inlineTooltip = new InlineTooltip(pm, value)
})

class Form {
  constructor(pm) {
    this.pm = pm
    this.form = this.build()
  }
  showDialog(tooltip, callback) {
    tooltip.show(this.name, this.form)
    this.form.addEventListener("submit", e => {
      e.preventDefault()
      callback(this.read())
    })
    this.form.addEventListener("keydown", e => {
      if (e.keyCode == 27) callback(null)
    })
    this.focus()
  }
  focus() {
    let input = this.form.querySelector("input")
    if (input) input.focus()
  }
}

class LinkForm extends Form {
  build() {
    return elt("form", {class: classPrefix + "-link-form", action: "."},
               elt("div", null, elt("input", {name: "href", type: "text", placeholder: "Target URL",
                                              size: 40, autocomplete: "off"})),
               elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title",
                                              size: 40, autocomplete: "off"}),
                   elt("button", {type: "submit", style: "display: none"})))
  }

  get name() { return "linkform" }

  read() {
    let elts = this.form.elements
    if (!elts.href.value) return null
    return style.link(elts.href.value, elts.title.value)
  }
}

class ImageForm extends Form {
  build() {
    let alt = this.pm.selectedText
    return elt("form", {class: classPrefix + "-image-form", action: "."},
               elt("div", null, elt("input", {name: "src", type: "text", placeholder: "Image URL",
                                              size: 40, autocomplete: "off"})),
               elt("div", null, elt("input", {name: "alt", type: "text", value: alt, autocomplete: "off",
                                              placeholder: "Description / alternative text", size: 40})),
               elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title",
                                              size: 40, autcomplete: "off"}),
                   elt("button", {type: "submit", style: "display: none"})))
  }

  get name() { return "imageform" }

  read() {
    let elts = this.form.elements
    if (!elts.src.value) return null
    let sel = this.pm.selection
    this.pm.apply({name: "replace", pos: sel.from, end: sel.to})
    let attrs = {src: elts.src.value, alt: elts.alt.value, title: elts.title.value}
    this.pm.apply({name: "insertInline", pos: sel.from, type: "image", attrs: attrs})
    return false
  }
}

export const defaultButtons = {
  strong: {icon: "bold", title: "Strong text", style: style.strong},
  em: {icon: "italic", title: "Emphasized text", style: style.em},
  link: {icon: "chain", title: "Hyperlink", form: LinkForm},
  image: {icon: "image", title: "Image", form: ImageForm},
  code: {icon: "code", title: "Code font", style: style.code}
}

class InlineTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.buttons = (config && config.buttons) || defaultButtons
    this.showLinks = config ? config.showLinks !== false : true
    this.pending = null

    this.tooltip = new Tooltip(pm, "above")

    pm.on("selectionChange", this.updateFunc = () => this.scheduleUpdate())
    pm.on("change", this.updateFunc)
  }

  detach() {
    this.tooltip.detach()
    
    pm.off("selectionChange", this.updateFunc)
    pm.off("change", this.updateFunc)
  }

  scheduleUpdate() {
    window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => {
      this.pending = null
      this.update()
    }, 100)
  }

  update() {
    let sel = this.pm.selection, link
    if (!this.pm.hasFocus()) {
      this.tooltip.close()
    } else if (!sel.empty) {
      let {left, top} = topCenterOfSelection()
      this.showTooltip(left, top)
    } else if (this.showLinks && (link = this.linkUnderCursor())) {
      let {left, top} = this.pm.coordsAtPos(sel.head)
      this.showLink(link, left, top)
    } else {
      this.tooltip.close()
    }
  }

  buildButtons() {
    let dom = elt("ul", {class: classPrefix})
    for (let type in this.buttons) {
      let button = this.buttons[type]
      let cls = "ProseMirror-icon ProseMirror-icon-" + button.icon
      let activeCls = this.isActive(type) ? classPrefix + "-active" : ""
      let li = dom.appendChild(elt("li", {class: activeCls, title: button.title}, elt("span", {class: cls})))
      li.addEventListener("mousedown", e => { e.preventDefault(); this.buttonClicked(type, button) })
    }
    return dom
  }

  isActive(type) {
    let sel = this.pm.selection
    return inline.rangeHasInlineStyle(this.pm.doc, sel.from, sel.to, type)
  }

  linkUnderCursor() {
    let styles = inline.inlineStylesAt(this.pm.doc, this.pm.selection.head)
    return styles.reduce((found, st) => found || (st.type == "link" && st), null)
  }

  showTooltip(left, top) {
    this.tooltip.show("inlinetooltip", this.buildButtons(), left, top)
  }

  showLink(link, left, top) {
    let node = elt("div", {class: classPrefix + "-linktext"}, elt("a", {href: link.href, title: link.title}, link.href))
    this.tooltip.show("link-" + link.href, node, left, top)
  }

  buttonClicked(type, button) {
    if (this.pending != null) return

    let sel = this.pm.selection
    this.tooltip.active = true
    let done = () => {
      this.tooltip.active = false
      this.showTooltip()
    }

    if (this.isActive(type)) {
      this.pm.apply({name: "removeStyle", pos: sel.from, end: sel.to, style: type})
      done()
    } else if (button.style) {
      this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: button.style})
      done()
    } else {
      (new button.form(this.pm)).showDialog(this.tooltip, st => {
        if (st)
          this.pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: st})
        if (st === false) this.update()
        else this.showTooltip()
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
        (i == rects.length - 1 || Math.abs(rects[i + 1].left - rects[i].left) > 1)) {
      left = Math.min(left, rects[i].left)
      right = Math.max(right, rects[i].right)
      top = Math.min(top, rects[i].top)
    }
  }
  return {top, left: (left + right) / 2}
}

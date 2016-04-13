export function elt(tag, attrs, ...args) {
  let result = document.createElement(tag)
  if (attrs) for (let name in attrs) {
    if (name == "style")
      result.style.cssText = attrs[name]
    else if (attrs[name] != null)
      result.setAttribute(name, attrs[name])
  }
  for (let i = 0; i < args.length; i++) add(args[i], result)
  return result
}

function add(value, target) {
  if (typeof value == "string")
    value = document.createTextNode(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) add(value[i], target)
  } else {
    target.appendChild(value)
  }
}


const reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
const cancelFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
      window.webkitCancelAnimationFrame || window.msCancelAnimationFrame

export function requestAnimationFrame(f) {
  if (reqFrame) return reqFrame(f)
  else return setTimeout(f, 10)
}

export function cancelAnimationFreame(handle) {
  if (reqFrame) return cancelFrame(handle)
  else clearTimeout(handle)
}

const ie_upto10 = /MSIE \d/.test(navigator.userAgent)
const ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent)

export const browser = {
  mac: /Mac/.test(navigator.platform),
  ie_upto10,
  ie_11up,
  ie: ie_upto10 || ie_11up,
  gecko: /gecko\/\d/i.test(navigator.userAgent)
}


// : (DOMNode, DOMNode) → bool
// Check whether a DOM node is an ancestor of another DOM node.
export function contains(parent, child) {
  // Android browser and IE will return false if child is a text node.
  if (child.nodeType != 1)
    child = child.parentNode
  return child && parent.contains(child)
}


let accumulatedCSS = "", cssNode = null

export function insertCSS(css) {
  if (cssNode) cssNode.textContent += css
  else accumulatedCSS += css
}

// This is called when a ProseMirror instance is created, to ensure
// the CSS is in the DOM.
export function ensureCSSAdded() {
  if (!cssNode) {
    cssNode = document.createElement("style")
    cssNode.textContent = "/* ProseMirror CSS */\n" + accumulatedCSS
    document.head.insertBefore(cssNode, document.head.firstChild)
  }
}

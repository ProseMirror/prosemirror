function elt(tag, attrs, ...args) {
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
exports.elt = elt

function add(value, target) {
  if (typeof value == "string")
    value = document.createTextNode(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) add(value[i], target)
  } else if (value) {
    target.appendChild(value)
  }
}


const reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
const cancelFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
      window.webkitCancelAnimationFrame || window.msCancelAnimationFrame

function requestAnimationFrame(f) {
  if (reqFrame) return reqFrame.call(window, f)
  else return setTimeout(f, 10)
}
exports.requestAnimationFrame = requestAnimationFrame

function cancelAnimationFrame(handle) {
  if (reqFrame) return cancelFrame.call(window, handle)
  else clearTimeout(handle)
}
exports.cancelAnimationFrame = cancelAnimationFrame

// : (DOMNode, DOMNode) → bool
// Check whether a DOM node is an ancestor of another DOM node.
function contains(parent, child) {
  // Android browser and IE will return false if child is a text node.
  if (child.nodeType != 1)
    child = child.parentNode
  return child && parent.contains(child)
}
exports.contains = contains


let accumulatedCSS = "", cssNode = null

function insertCSS(css) {
  if (cssNode) cssNode.textContent += css
  else accumulatedCSS += css
}
exports.insertCSS = insertCSS

// This is called when a ProseMirror instance is created, to ensure
// the CSS is in the DOM.
function ensureCSSAdded() {
  if (!cssNode) {
    cssNode = document.createElement("style")
    cssNode.textContent = "/* ProseMirror CSS */\n" + accumulatedCSS
    document.head.insertBefore(cssNode, document.head.firstChild)
  }
}
exports.ensureCSSAdded = ensureCSSAdded

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

export function requestAnimationFrame(f) {
  if (reqFrame) reqFrame(f)
  else setTimeout(f, 10)
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


function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*"); }

export function rmClass(node, cls) {
  let current = node.className
  let match = classTest(cls).exec(current)
  if (match) {
    let after = current.slice(match.index + match[0].length)
    node.className = current.slice(0, match.index) + (after ? match[1] + after : "")
  }
}

export function addClass(node, cls) {
  let current = node.className
  if (!classTest(cls).test(current)) node.className += (current ? " " : "") + cls
}


export function contains(parent, child) {
  // Android browser and IE will return false if child is a text node.
  if (child.nodeType != 1)
    child = child.parentNode
  return child && parent.contains(child)
}

export function insertCSS(css) {
  var style = document.createElement("style")
  style.textContent = css
  document.head.insertBefore(style, document.head.firstChild)
}

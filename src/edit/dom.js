export function elt(tag, attrs, ...args) {
  let result = document.createElement(tag)
  if (attrs) for (let name in attrs) {
    if (name == "style")
      result.style.cssText = attrs[name]
    else if (attrs[name] != null)
      result.setAttribute(name, attrs[name])
  }
  for (let i = 0; i < args.length; i++) {
    let arg = args[i]
    if (typeof arg == "string") arg = document.createTextNode(arg)
    result.appendChild(arg)
  }
  return result
}

const reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame

export function requestAnimationFrame(f) {
  if (reqFrame) reqFrame(f)
  else setTimeout(f, 10)
}

export const mac = /Mac/.test(navigator.platform)

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

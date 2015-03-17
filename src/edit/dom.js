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

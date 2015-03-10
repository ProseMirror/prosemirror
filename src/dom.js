export function elt(tag, attrs, ...args) {
  if (typeof attrs == "string" || attrs.nodeType) {
    args.unshift(attrs)
    attrs = null
  }
  let result = document.createElement(tag)
  if (attrs) for (let name in attrs) {
    if (name == "style")
      result.style.cssText = attrs[name]
    else
      result.setAttribute(name, attrs[name])
  }
  for (let i = 0; i < args.length; i++) {
    let arg = args[i]
    if (typeof arg == "string") arg = document.createTextNode(arg)
    result.appendChild(arg)
  }
  return result
}

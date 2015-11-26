import {insertCSS} from "../dom"

let svgCollection = null
const svgBuilt = Object.create(null)

const SVG = "http://www.w3.org/2000/svg"
const XLINK = "http://www.w3.org/1999/xlink"

export function getIcon(name, data) {
  if (data.path) {
    if (!svgBuilt[name]) buildSVG(name, data)
    let node = document.createElementNS(SVG, "svg")
    node.setAttribute("class", "ProseMirror-icon")
    node.style.width = (data.width / data.height) + "em"
    let use = node.appendChild(document.createElementNS(SVG, "use"))
    use.setAttributeNS(XLINK, "href", "#pm-icon-" + name)
    return node
  } else {
    let span = document.createElement("span")
    span.textContent = data.text
    if (data.css) span.style.cssText = data.css
    return span
  }
}

function buildSVG(name, data) {
  if (!svgCollection) {
    svgCollection = document.createElementNS(SVG, "svg")
    svgCollection.style.display = "none"
    document.body.insertBefore(svgCollection, document.body.firstChild)
  }
  let sym = document.createElementNS(SVG, "symbol")
  sym.id = "pm-icon-" + name
  sym.setAttribute("viewBox", "0 0 " + data.width + " " + data.height)
  let path = sym.appendChild(document.createElementNS(SVG, "path"))
  path.setAttribute("d", data.path)
  svgCollection.appendChild(sym)
  svgBuilt[name] = true
}

insertCSS(`
.ProseMirror-icon {
  fill: currentColor;
  height: 1em;
  vertical-align: middle;
}
`)

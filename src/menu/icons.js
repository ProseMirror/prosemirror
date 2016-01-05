import {insertCSS} from "../dom"

let svgCollection = null
const svgBuilt = Object.create(null)

const SVG = "http://www.w3.org/2000/svg"
const XLINK = "http://www.w3.org/1999/xlink"

const prefix = "ProseMirror-icon"

export function getIcon(name, data) {
  let node = document.createElement("div")
  node.className = prefix
  if (data.path) {
    if (!svgBuilt[name]) buildSVG(name, data)
    let svg = node.appendChild(document.createElementNS(SVG, "svg"))
    svg.style.width = (data.width / data.height) + "em"
    let use = svg.appendChild(document.createElementNS(SVG, "use"))
    use.setAttributeNS(XLINK, "href", "#pm-icon-" + name)
  } else {
    node.appendChild(document.createElement("span")).textContent = data.text
    if (data.css) node.firstChild.style.cssText = data.css
  }
  return node
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
.${prefix} {
  display: inline-block;
  line-height: .8;
  vertical-align: -2px; /* Compensate for padding */
  padding: 2px 8px;
  cursor: pointer;
}

.${prefix}-active {
  background: #666;
  border-radius: 4px;
}

.${prefix} svg {
  fill: currentColor;
  height: 1em;
}

.${prefix} span {
  vertical-align: text-top;
}`)

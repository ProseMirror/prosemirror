const {insertCSS} = require("../util/dom")

let svgCollection = null
const svgBuilt = Object.create(null)

const SVG = "http://www.w3.org/2000/svg"
const XLINK = "http://www.w3.org/1999/xlink"

const prefix = "ProseMirror-icon"

function hashPath(path) {
  let hash = 0
  for (let i = 0; i < path.length; i++)
    hash = (((hash << 5) - hash) + path.charCodeAt(i)) | 0
  return hash
}

function getIcon(icon) {
  let node = document.createElement("div")
  node.className = prefix
  if (icon.path) {
    let name = "pm-icon-" + hashPath(icon.path).toString(16)
    if (!svgBuilt[name]) buildSVG(name, icon)
    let svg = node.appendChild(document.createElementNS(SVG, "svg"))
    svg.style.width = (icon.width / icon.height) + "em"
    let use = svg.appendChild(document.createElementNS(SVG, "use"))
    use.setAttributeNS(XLINK, "href", /([^#]*)/.exec(document.location)[1] + "#" + name)
  } else if (icon.dom) {
    node.appendChild(icon.dom.cloneNode(true))
  } else {
    node.appendChild(document.createElement("span")).textContent = icon.text || ''
    if (icon.css) node.firstChild.style.cssText = icon.css
  }
  return node
}
exports.getIcon = getIcon

function buildSVG(name, data) {
  if (!svgCollection) {
    svgCollection = document.createElementNS(SVG, "svg")
    svgCollection.style.display = "none"
    document.body.insertBefore(svgCollection, document.body.firstChild)
  }
  let sym = document.createElementNS(SVG, "symbol")
  sym.id = name
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

.${prefix} svg {
  fill: currentColor;
  height: 1em;
}

.${prefix} span {
  vertical-align: text-top;
}`)

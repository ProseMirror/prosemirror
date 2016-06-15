const {baseKeymap} = require("./keymap")

// Object mapping option names to default values.
const options = Object.create(null)

// :: Schema #path=schema #kind=option
// The [schema](#Schema) that the editor's document should use. Will
// default to the schema of the `doc` option, if that is given.
options.schema = null

// :: Node #path=doc #kind=option
// The starting document.
options.doc = null

// :: ?union<DOMNode, (DOMNode)> #path=place #kind=option
// Determines the placement of the editor in the page. When `null`,
// the editor is not placed. When a DOM node is given, the editor is
// appended to that node. When a function is given, it is called
// with the editor's wrapping DOM node, and is expected to place it
// into the document.
options.place = null

// :: number #path=historyDepth #kind=option
// The amount of history events that are collected before the oldest
// events are discarded. Defaults to 100.
options.historyDepth = 100

// :: number #path=historyEventDelay #kind=option
// The amount of milliseconds that must pass between changes to
// start a new history event. Defaults to 500.
options.historyEventDelay = 500

// :: number #path=scrollThreshold #kind=option
// The minimum distance to keep between the position of document
// changes and the editor bounding rectangle before scrolling the view.
// Defaults to 0.
options.scrollThreshold = 0

// :: number #path=scrollMargin #kind=option
// Determines how far to scroll when the scroll threshold is
// surpassed. Defaults to 5.
options.scrollMargin = 5

// :: Keymap #path=keymap #kind=option
// Sets the base keymap for the editor. Defaults to `baseKeymap`.
options.keymap = baseKeymap

// :: ?string #path=label #kind=option
// The label of the editor. When set, the editable DOM node gets an
// `aria-label` attribute with this value.
options.label = null

// :: ?(string) → string #path=translate #kind=option
// Optional function to translate strings such as menu labels and prompts.
// When set, should be a function that takes a string as argument and returns
// a string, i.e. :: (string) → string
options.translate = null

// :: [Plugin] #path=plugins #kind=option
// A set of plugins to enable when the editor is initialized. Defaults
// to the empty array.
options.plugins = []

function parseOptions(obj) {
  let result = Object.create(null)
  for (let option in options)
    result[option] = Object.prototype.hasOwnProperty.call(obj, option) ? obj[option] : options[option]
  return result
}
exports.parseOptions = parseOptions

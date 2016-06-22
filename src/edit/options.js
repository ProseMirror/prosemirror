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

// :: number #path=scrollThreshold #kind=option
// The minimum distance to keep between the position of document
// changes and the editor bounding rectangle before scrolling the view.
// Defaults to 0.
options.scrollThreshold = 0

// :: number #path=scrollMargin #kind=option
// Determines how far to scroll when the scroll threshold is
// surpassed. Defaults to 5.
options.scrollMargin = 5

// :: [Keymap] #path=keymaps #kind=option
// Provides an array of starting keymaps for the editor. These will be
// added, in order, with a priority of -100, so that the ones coming
// earlier in the array take precedence, and keymaps added with
// `addKeymap` will, unless given a large negative priority, end up
// with a higher priority than these. Defaults to the empty array.
options.keymaps = []

// :: ?string #path=label #kind=option
// The label of the editor. When set, the editable DOM node gets an
// `aria-label` attribute with this value.
options.label = null

// :: ?(string) → string #path=translate #kind=option
// Optional function to translate strings such as menu labels and prompts.
// When set, should be a function that takes a string as argument and returns
// a string, i.e. :: (string) → string
options.translate = null

// :: bool #path=spellCheck #kind=option
// Controls whether the browser's native spell-checking is enabled for
// the editor. Defaults to true. Due to the way ProseMirror works,
// some browsers may get confused and not show spelling hints as
// expected.
options.spellCheck = true

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

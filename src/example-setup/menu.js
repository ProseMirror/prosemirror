const {StrongMark, EmMark, CodeMark, LinkMark, Image, BulletList, OrderedList, BlockQuote,
       Heading, Paragraph, CodeBlock, HorizontalRule} = require("../schema-basic")
const {toggleMarkItem, insertItem, wrapItem, blockTypeItem, Dropdown, DropdownSubmenu, joinUpItem, liftItem,
       selectParentNodeItem, undoItem, redoItem, wrapListItem, icons} = require("../menu")

const {FieldPrompt, TextField} = require("../ui/prompt")

// Helpers to create specific types of items

// : (ProseMirror, (attrs: ?Object))
// A function that will prompt for the attributes of a [link
// mark](#LinkMark) (using `FieldPrompt`), and call a callback with
// the result.
function promptLinkAttrs(pm, callback) {
  new FieldPrompt(pm, "Create a link", {
    href: new TextField({
      label: "Link target",
      required: true,
      clean: (val) => {
        if (!/^https?:\/\//i.test(val))
          val = 'http://' + val
        return val
      }
    }),
    title: new TextField({label: "Title"})
  }).open(callback)
}

// : (ProseMirror, (attrs: ?Object))
// A function that will prompt for the attributes of an [image
// node](#Image) (using `FieldPrompt`), and call a callback with the
// result.
function promptImageAttrs(pm, callback, nodeType) {
  let {node, from, to} = pm.selection, attrs = nodeType && node && node.type == nodeType && node.attrs
  new FieldPrompt(pm, "Insert image", {
    src: new TextField({label: "Location", required: true, value: attrs && attrs.src}),
    title: new TextField({label: "Title", value: attrs && attrs.title}),
    alt: new TextField({label: "Description",
                        value: attrs ? attrs.title : pm.doc.textBetween(from, to, " ")})
  }).open(callback)
}

// :: (Schema) → Object
// Given a schema, look for default mark and node types in it and
// return an object with relevant menu items relating to those marks:
//
// **`toggleStrong`**`: MenuItem`
//   : A menu item to toggle the [strong mark](#StrongMark).
//
// **`toggleEm`**`: MenuItem`
//   : A menu item to toggle the [emphasis mark](#EmMark).
//
// **`toggleCode`**`: MenuItem`
//   : A menu item to toggle the [code font mark](#CodeMark).
//
// **`toggleLink`**`: MenuItem`
//   : A menu item to toggle the [link mark](#LinkMark).
//
// **`insertImage`**`: MenuItem`
//   : A menu item to insert an [image](#Image).
//
// **`wrapBulletList`**`: MenuItem`
//   : A menu item to wrap the selection in a [bullet list](#BulletList).
//
// **`wrapOrderedList`**`: MenuItem`
//   : A menu item to wrap the selection in an [ordered list](#OrderedList).
//
// **`wrapBlockQuote`**`: MenuItem`
//   : A menu item to wrap the selection in a [block quote](#BlockQuote).
//
// **`makeParagraph`**`: MenuItem`
//   : A menu item to set the current textblock to be a normal
//     [paragraph](#Paragraph).
//
// **`makeCodeBlock`**`: MenuItem`
//   : A menu item to set the current textblock to be a
//     [code block](#CodeBlock).
//
// **`makeHead[N]`**`: MenuItem`
//   : Where _N_ is 1 to 6. Menu items to set the current textblock to
//     be a [heading](#Heading) of level _N_.
//
// **`insertHorizontalRule`**`: MenuItem`
//   : A menu item to insert a horizontal rule.
//
// The return value also contains some prefabricated menu elements and
// menus, that you can use instead of composing your own menu from
// scratch:
//
// **`insertMenu`**`: Dropdown`
//   : A dropdown containing the `insertImage` and
//     `insertHorizontalRule` items.
//
// **`typeMenu`**`: Dropdown`
//   : A dropdown containing the items for making the current
//     textblock a paragraph, code block, or heading.
//
// **`inlineMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the inline menu
//     to, for example, a [tooltip menu](#menu/tooltipmenu).
//
// **`blockMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the block menu
//     to, for example, a [tooltip menu](#menu/tooltipmenu).
//
// **`fullMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the full menu
//     for, for example the [menu bar](#menuBar).
function buildMenuItems(schema) {
  let r = {}
  for (let name in schema.marks) {
    let mark = schema.marks[name]
    if (mark instanceof StrongMark)
      r.toggleStrong = toggleMarkItem(mark, {title: "Toggle strong style", icon: icons.strong})
    if (mark instanceof EmMark)
      r.toggleEm = toggleMarkItem(mark, {title: "Toggle emphasis", icon: icons.em})
    if (mark instanceof CodeMark)
      r.toggleCode = toggleMarkItem(mark, {title: "Toggle code font", icon: icons.code})
    if (mark instanceof LinkMark)
      r.toggleLink = toggleMarkItem(mark, {title: "Add or remove link", icon: icons.link, attrs: promptLinkAttrs})
  }
  for (let name in schema.nodes) {
    let node = schema.nodes[name]
    if (node instanceof Image)
      r.insertImage = insertItem(node, {
        title: "Insert image",
        label: "Image",
        attrs: (pm, c) => promptImageAttrs(pm, c, node)
      })
    if (node instanceof BulletList)
      r.wrapBulletList = wrapListItem(node, {
        title: "Wrap in bullet list",
        icon: icons.bulletList
      })
    if (node instanceof OrderedList)
      r.wrapOrderedList = wrapListItem(node, {
        title: "Wrap in ordered list",
        icon: icons.orderedList
      })
    if (node instanceof BlockQuote)
      r.wrapBlockQuote = wrapItem(node, {
        title: "Wrap in block quote",
        icon: icons.blockquote
      })
    if (node instanceof Paragraph)
      r.makeParagraph = blockTypeItem(node, {
        title: "Change to paragraph",
        label: "Plain"
      })
    if (node instanceof CodeBlock)
      r.makeCodeBlock = blockTypeItem(node, {
        title: "Change to code block",
        label: "Code"
      })
    if (node instanceof Heading)
      for (let i = 1; i <= 10; i++)
        r["makeHead" + i] = blockTypeItem(node, {
          title: "Change to heading " + i,
          label: "Level " + i,
          attrs: {level: i}
        })
    if (node instanceof HorizontalRule)
      r.insertHorizontalRule = insertItem(node, {
        title: "Insert horizontal rule",
        label: "Horizontal rule"
      })
  }

  let cut = arr => arr.filter(x => x)
  r.insertMenu = new Dropdown(cut([r.insertImage, r.insertHorizontalRule]), {label: "Insert"})
  r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1 && new DropdownSubmenu(cut([
    r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6
  ]), {label: "Heading"})]), {label: "Type..."})
  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink]), [r.insertMenu]]
  r.blockMenu = [cut([r.typeMenu, r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
                           liftItem, selectParentNodeItem])]
  r.fullMenu = r.inlineMenu.concat(r.blockMenu).concat([[undoItem, redoItem]])

  return r
}
exports.buildMenuItems = buildMenuItems

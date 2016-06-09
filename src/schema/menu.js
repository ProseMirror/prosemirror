const {StrongMark, EmMark, CodeMark, LinkMark, Image, BulletList, OrderedList, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule} = require("./index")
const {toggleMarkItem, insertItem, wrapItem, blockTypeItem, Dropdown, joinUpItem, liftItem, selectParentNodeItem, undoItem, redoItem, wrapListItem} = require("../menu/menu")

const {FieldPrompt, TextField} = require("../ui/prompt")

// !! This module defines some helpers for easily generating a basic
// menu for the default schema or a schema that is closely based on
// it.

// :: Object A set of icons used in the default menu. Contains the
// properties `strong`, `em`, `code`, `link`, `bulletList`,
// `orderedList`, and `blockquote`, each holding an object that can be
// used as the `icon` option to `MenuItem`.
const schemaIcons = {
  strong: {
    width: 805, height: 1024,
    path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
  },
  em: {
    width: 585, height: 1024,
    path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
  },
  code: {
    width: 896, height: 1024,
    path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
  },
  link: {
    width: 951, height: 1024,
    path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
  },
  bulletList: {
    width: 768, height: 896,
    path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
  },
  orderedList: {
    width: 768, height: 896,
    path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
  },
  blockquote: {
    width: 640, height: 896,
    path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
  }
}
exports.schemaIcons = schemaIcons

// Helpers to create specific types of items

// :: (ProseMirror, (attrs: ?Object))
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
  })
    .open(callback)
}
exports.promptLinkAttrs = promptLinkAttrs

// :: (ProseMirror, (attrs: ?Object))
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
exports.promptImageAttrs = promptImageAttrs

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
//     for, for example the [menu bar](#menu/menubar).
function defaultMenuItems(schema) {
  let r = {}
  for (let name in schema.marks) {
    let mark = schema.marks[name]
    if (mark instanceof StrongMark)
      r.toggleStrong = toggleMarkItem(mark, {title: "Toggle strong style", icon: schemaIcons.strong})
    if (mark instanceof EmMark)
      r.toggleEm = toggleMarkItem(mark, {title: "Toggle emphasis", icon: schemaIcons.em})
    if (mark instanceof CodeMark)
      r.toggleCode = toggleMarkItem(mark, {title: "Toggle code font", icon: schemaIcons.code})
    if (mark instanceof LinkMark)
      r.toggleLink = toggleMarkItem(mark, {title: "Add or remove link", icon: schemaIcons.link, attrs: promptLinkAttrs})
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
        icon: schemaIcons.bulletList
      })
    if (node instanceof OrderedList)
      r.wrapOrderedList = wrapListItem(node, {
        title: "Wrap in ordered list",
        icon: schemaIcons.orderedList
      })
    if (node instanceof BlockQuote)
      r.wrapBlockQuote = wrapItem(node, {
        title: "Wrap in block quote",
        icon: schemaIcons.blockquote
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
          label: "Head " + i,
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
  r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1,
                                 r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5,
                                 r.makeHead6]), {label: "Type..."})
  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink]), [r.insertMenu]]
  r.blockMenu = [cut([r.typeMenu, r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
                           liftItem, selectParentNodeItem])]
  r.fullMenu = r.inlineMenu.concat(r.blockMenu).concat([[undoItem, redoItem]])

  return r
}
exports.defaultMenuItems = defaultMenuItems

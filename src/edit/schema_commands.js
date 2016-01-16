import {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongMark, EmMark, CodeMark, LinkMark, Image, Pos} from "../model"

import {selectedNodeAttr} from "./command"
import {toText} from "../format"

// # Mark types

// ;; #path="strong:set" #kind=command
// Add the [strong](#StrongMark) mark to the selected content.
StrongMark.register("command", "set", {derive: true, label: "Set strong"})

// ;; #path="strong:unset" #kind=command
// Remove the [strong](#StrongMark) mark from the selected content.
StrongMark.register("command", "unset", {derive: true, label: "Unset strong"})

// ;; #path="strong:toggle" #kind=command
// Toggle the [strong](#StrongMark) mark. If there is any strong
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the strong mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content strong.
//
// **Keybindings:** Mod-B
//
// Registers itself in the inline [menu group](#CommandSpec.menuGroup).
StrongMark.register("command", "toggle", {
  derive: true,
  label: "Toggle strong",
  menuGroup: "inline(20)",
  display: {
    type: "icon",
    width: 805, height: 1024,
    path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
  },
  keys: ["Mod-B"]
})

// ;; #path=em:set #kind=command
// Add the [emphasis](#EmMark) mark to the selected content.
EmMark.register("command", "set", {derive: true, label: "Add emphasis"})

// ;; #path=em:unset #kind=command
// Remove the [emphasis](#EmMark) mark from the selected content.
EmMark.register("command", "unset", {derive: true, label: "Remove emphasis"})

// ;; #path=em:toggle #kind=command
// Toggle the [emphasis](#EmMark) mark. If there is any emphasized
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the emphasis mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content emphasized.
//
// **Keybindings:** Mod-I
//
// Registers itself in the inline [menu group](#CommandSpec.menuGroup).
EmMark.register("command", "toggle", {
  derive: true,
  label: "Toggle emphasis",
  menuGroup: "inline(21)",
  display: {
    type: "icon",
    width: 585, height: 1024,
    path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
  },
  keys: ["Mod-I"]
})

// ;; #path=code:set #kind=command
// Add the [code](#CodeMark) mark to the selected content.
CodeMark.register("command", "set", {derive: true, label: "Set code style"})

// ;; #path=code:unset #kind=command
// Remove the [code](#CodeMark) mark from the selected content.
CodeMark.register("command", "unset", {derive: true, label: "Remove code style"})

// ;; #path=code:toggle #kind=command
// Toggle the [code](#CodeMark) mark. If there is any code-styled
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the code mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// styles the selected content as code.
//
// **Keybindings:** Mod-`
//
// Registers itself in the inline [menu group](#CommandSpec.menuGroup).
CodeMark.register("command", "toggle", {
  derive: true,
  label: "Toggle code style",
  menuGroup: "inline(22)",
  display: {
    type: "icon",
    width: 896, height: 1024,
    path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
  },
  keys: ["Mod-`"]
})

const linkIcon = {
  type: "icon",
  width: 951, height: 1024,
  path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
}

// ;; #path=link:unset #kind=command
// Removes all links for the selected content, or, if there is no
// selection, from the [active marks](#ProseMirror.activeMarks). Will
// only [select](#Command.select) itself when there is a link in the
// selection or active marks.
//
// Registers itself in the inline [menu group](#CommandSpec.menuGroup).
LinkMark.register("command", "unset", {
  derive: true,
  label: "Unlink",
  menuGroup: "inline(30)",
  active() { return true },
  display: linkIcon
})

// ;; #path=link:set #kind=command
// Adds a link mark to the selection or set of [active
// marks](#ProseMirror.activeMarks). Takes parameters to determine the
// attributes of the link:
//
// **`href`**`: string`
//   : The link's target.
//
// **`title`**`: string`
//   : The link's title.
//
// Adds itself to the inline [menu group](#CommandSpec.menuGroup). Only selects itself when
// `unlink` isn't selected, so that only one of the two is visible in
// the menu at any time.
LinkMark.register("command", "set", {
  derive: {
    inverseSelect: true,
    params: [
      {label: "Target", attr: "href"},
      {label: "Title", attr: "title"}
    ]
  },
  label: "Add link",
  menuGroup: "inline(30)",
  display: linkIcon
})

// Node types

// ;; #path=image:insert #kind=command
// Replace the selection with an [image](#Image) node. Takes paramers
// that specify the image's attributes:
//
// **`src`**`: string`
//   : The URL of the image.
//
// **`alt`**`: string`
//   : The alt text for the image.
//
// **`title`**`: string`
//   : A title for the image.
//
// Registers itself in the inline [menu group](#CommandSpec.menuGroup).
Image.register("command", "insert", {
  derive: {
    params: [
      {label: "Image URL", attr: "src"},
      {label: "Description / alternative text", attr: "alt",
       prefill: function(pm) {
         return selectedNodeAttr(pm, this, "alt") || toText(pm.doc.sliceBetween(pm.selection.from, pm.selection.to))
       }},
      {label: "Title", attr: "title"}
    ]
  },
  label: "Insert image",
  display: {
    type: "icon",
    width: 1097, height: 1024,
    path: "M365 329q0 45-32 77t-77 32-77-32-32-77 32-77 77-32 77 32 32 77zM950 548v256h-804v-109l182-182 91 91 292-292zM1005 146h-914q-7 0-12 5t-5 12v694q0 7 5 12t12 5h914q7 0 12-5t5-12v-694q0-7-5-12t-12-5zM1097 164v694q0 37-26 64t-64 26h-914q-37 0-64-26t-26-64v-694q0-37 26-64t64-26h914q37 0 64 26t26 64z"
  }
})

// ;; #path=bullet_list:wrap #kind=command
// Wrap the selection in a bullet list.
//
// **Keybindings:** Alt-Right '*', Alt-Right '-'
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup).
BulletList.register("command", "wrap", {
  derive: {list: true},
  label: "Wrap the selection in a bullet list",
  menuGroup: "block(40)",
  display: {
    type: "icon",
    width: 768, height: 896,
    path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
  },
  keys: ["Alt-Right '*'", "Alt-Right '-'"]
})

// ;; #path=ordered_list:wrap #kind=command
// Wrap the selection in an ordered list.
//
// **Keybindings:** Alt-Right '1'
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup).
OrderedList.register("command", "wrap", {
  derive: {list: true},
  label: "Wrap the selection in an ordered list",
  menuGroup: "block(41)",
  display: {
    type: "icon",
    width: 768, height: 896,
    path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
  },
  keys: ["Alt-Right '1'"]
})

// ;; #path=blockquote:wrap #kind=command
// Wrap the selection in a block quote.
//
// **Keybindings:** Alt-Right '>', Alt-Right '"'
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup).
BlockQuote.register("command", "wrap", {
  derive: true,
  label: "Wrap the selection in a block quote",
  menuGroup: "block(45)",
  display: {
    type: "icon",
    width: 640, height: 896,
    path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
  },
  keys: ["Alt-Right '>'", "Alt-Right '\"'"]
})

// ;; #path=hard_break:insert #kind=command
// Replace the selection with a hard break node. If the selection is
// in a node whose [type](#NodeType) has a truthy `isCode` property
// (such as `CodeBlock` in the default schema), a regular newline is
// inserted instead.
//
// **Keybindings:** Mod-Enter, Shift-Enter
HardBreak.register("command", "insert", {
  label: "Insert hard break",
  run(pm) {
    let {node, from} = pm.selection
    if (node && node.isBlock)
      return false
    else if (pm.doc.path(from.path).type.isCode)
      return pm.tr.typeText("\n").apply(pm.apply.scroll)
    else
      return pm.tr.replaceSelection(this.create()).apply(pm.apply.scroll)
  },
  keys: ["Mod-Enter", "Shift-Enter"]
})

// ;; #path=list_item:split #kind=command
// If the selection is a text selection inside of a child of a list
// item, split that child and the list item, and delete the selection.
//
// **Keybindings:** Enter
ListItem.register("command", "split", {
  label: "Split the current list item",
  run(pm) {
    let {from, to, node} = pm.selection
    if ((node && node.isBlock) ||
        from.path.length < 2 || !Pos.samePath(from.path, to.path)) return false
    let toParent = from.shorten(), grandParent = pm.doc.path(toParent.path)
    if (grandParent.type != this) return false
    let nextType = to.offset == grandParent.child(toParent.offset).size ? pm.schema.defaultTextblockType() : null
    return pm.tr.delete(from, to).split(from, 2, nextType).apply(pm.apply.scroll)
  },
  keys: ["Enter(50)"]
})

for (let i = 1; i <= 10; i++)
  // ;; #path=:heading::make_ #kind=command
  // The commands `make1` to `make6` set the textblocks in the
  // selection to become headers with the given level.
  //
  // **Keybindings:** Mod-H '1' through Mod-H '6'
  Heading.registerComputed("command", "make" + i, type => {
    if (i <= type.maxLevel) return {
      derive: {name: "make", attrs: {level: i}},
      label: "Change to heading " + i,
      keys: [`Mod-H '${i}'`]
    }
  })

// ;; #path=paragraph:make #kind=command
// Set the textblocks in the selection to be regular paragraphs.
//
// **Keybindings:** Mod-P
Paragraph.register("command", "make", {
  derive: true,
  label: "Change to paragraph",
  keys: ["Mod-P"]
})

// ;; #path=code_block:make #kind=command
// Set the textblocks in the selection to be code blocks.
//
// **Keybindings:** Mod-\
CodeBlock.register("command", "make", {
  derive: true,
  label: "Change to code block",
  keys: ["Mod-\\"]
})

// ;; #path=horizontal_rule:insert #kind=command
// Replace the selection with a horizontal rule.
//
// **Keybindings:** Mod-Shift-Minus
HorizontalRule.register("command", "insert", {
  derive: true,
  label: "Insert horizontal rule",
  keys: ["Mod-Shift--"]
})

// Used by the textblockType command

Paragraph.register("textblockMenu", "main", {label: "Normal", rank: 10})

CodeBlock.register("textblockMenu", "main", {label: "Code", rank: 20})

for (let i = 1; i <= 10; i++)
  Heading.registerComputed("textblockMenu", String(i), type => {
    if (i <= type.maxLevel) return {label: "Head " + i, attrs: {level: i}, rank: 30 + i}
  })

// Used by the insert command

Image.register("insertMenu", "main", {label: "Image", command: "insert", rank: 20})

HorizontalRule.register("insertMenu", "main", {label: "Horizontal rule", command: "insert", rank: 70})

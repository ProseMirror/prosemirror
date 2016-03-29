import {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongMark, EmMark, CodeMark, LinkMark, Image} from "../model"

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
StrongMark.register("command", "toggle", {
  derive: true,
  label: "Toggle strong",
  menu: {
    group: "inline", rank: 20,
    display: {
      type: "icon",
      width: 805, height: 1024,
      path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
    }
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
EmMark.register("command", "toggle", {
  derive: true,
  label: "Toggle emphasis",
  menu: {
    group: "inline", rank: 21,
    display: {
      type: "icon",
      width: 585, height: 1024,
      path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
    }
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
CodeMark.register("command", "toggle", {
  derive: true,
  label: "Toggle code style",
  menu: {
    group: "inline", rank: 22,
    display: {
      type: "icon",
      width: 896, height: 1024,
      path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
    }
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
LinkMark.register("command", "unset", {
  derive: true,
  label: "Unlink",
  menu: {group: "inline", rank: 30, display: linkIcon},
  active() { return true }
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
// Only selects itself when `unlink` isn't selected, so that only one
// of the two is visible in the menu at any time.
LinkMark.register("command", "set", {
  derive: {
    inverseSelect: true,
    params: [
      {label: "Target", attr: "href"},
      {label: "Title", attr: "title"}
    ]
  },
  label: "Add link",
  menu: {group: "inline", rank: 30, display: linkIcon}
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
Image.register("command", "insert", {
  derive: {
    params: [
      {label: "Image URL", attr: "src"},
      {label: "Description / alternative text", attr: "alt",
       prefill: function(pm) {
         return selectedNodeAttr(pm, this, "alt") || toText(pm.doc.cut(pm.selection.from, pm.selection.to))
       }},
      {label: "Title", attr: "title"}
    ]
  },
  label: "Insert image",
  menu: {
    group: "insert", rank: 20,
    display: {type: "label", label: "Image"}
  }
})

// ;; #path=bullet_list:wrap #kind=command
// Wrap the selection in a bullet list.
//
// **Keybindings:** Shift-Mod-8
BulletList.register("command", "wrap", {
  derive: {list: true},
  label: "Wrap the selection in a bullet list",
  menu: {
    group: "block", rank: 40,
    display: {
      type: "icon",
      width: 768, height: 896,
      path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
    }
  },
  keys: ["Shift-Mod-8"]
})

// ;; #path=ordered_list:wrap #kind=command
// Wrap the selection in an ordered list.
//
// **Keybindings:** Shift-Mod-8
OrderedList.register("command", "wrap", {
  derive: {list: true},
  label: "Wrap the selection in an ordered list",
  menu: {
    group: "block", rank: 41,
    display: {
      type: "icon",
      width: 768, height: 896,
      path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
    }
  },
  keys: ["Shift-Mod-9"]
})

// ;; #path=blockquote:wrap #kind=command
// Wrap the selection in a block quote.
//
// **Keybindings:** Shift-Mod-.
BlockQuote.register("command", "wrap", {
  derive: true,
  label: "Wrap the selection in a block quote",
  menu: {
    group: "block", rank: 45,
    display: {
      type: "icon",
      width: 640, height: 896,
      path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
    }
  },
  keys: ["Shift-Mod-."]
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
    else if (pm.doc.resolve(from).parent.type.isCode)
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
    let {from, to, node} = pm.selection, $from = pm.doc.resolve(from)
    if ((node && node.isBlock) ||
        $from.depth < 2 || !$from.sameParent(pm.doc.resolve(to))) return false
    let grandParent = $from.node($from.depth - 1)
    if (grandParent.type != this) return false
    let nextType = to == $from.end($from.depth) ? pm.schema.defaultTextblockType() : null
    return pm.tr.delete(from, to).split(from, 2, nextType).apply(pm.apply.scroll)
  },
  keys: ["Enter(50)"]
})

function isListItem(pm, pos) {
  return pm.doc.path(pos.toPath()).type == pm.schema.nodes.list_item
}

function getListItemSelection(pm) {
  let {from, to} = pm.selection
  // When inside a list item, the selection points to a paragraph with an offset. Shortening the position
  // twice leads to the list item that contains the active paragraph
  let fromListItemPos = from.shorten().shorten()
  let toListItemPos = to.shorten().shorten()

  return {
    from: isListItem(pm, fromListItemPos) ? fromListItemPos : null,
    to: isListItem(pm, toListItemPos) ? toListItemPos : null
  }
}

// ;; #path=list_item:indent #kind=command
// If the selection starts and ends in a list item, indent the selected list items
//
// **Keybindings:** Tab
ListItem.register("command", "indent", {
  label: "Indent the selected list items",
  run(pm) {
    // Make sure that the start and end of the selection is inside list items
    let {from: fromListItemPos, to: toListItemPos} = getListItemSelection(pm)
    if (fromListItemPos == null || toListItemPos == null)
      return false

    // Do not indent item if it's the first in the list (already at maximum indention)
    if (fromListItemPos.offset === 0)
      return true // Return true as the command was handled and we don't want the cursor to jump away

    let sameParent = Pos.samePath(fromListItemPos.path, toListItemPos.path)

    let wrapFrom = fromListItemPos, wrapTo
    if (!sameParent) {
      // If the selection ends in a different parent than the start of the selection, only indent the start item
      wrapTo = wrapFrom.move(1)
    }
    else {
      // Selection ends in the same parent and builds a sibling range that should be unindented
      wrapTo = toListItemPos.move(1)
    }

    let parentListPos = wrapFrom.shorten()
    let parentList = pm.doc.path(parentListPos.toPath())
    let listType = parentList.type
    let itemType = pm.schema.nodes.list_item

    let tr = pm.tr

    // Indent items of the given range by wrapping them in a list
    // We need to additionally wrap this list in a temporary list item as the schema only allows
    // list items inside lists
    tr.step('ancestor', wrapFrom, wrapTo, null, {depth: 0, types: [itemType, listType]})

    // Remove the temporary wrapping list item by joining it
    tr.join(wrapFrom)

    // If the element above the new list is a list too, join the two lists
    let oldSiblingAbovePath = wrapFrom.move(-1).toPath()
    let newSiblingAbovePos = new Pos(oldSiblingAbovePath, pm.doc.path(oldSiblingAbovePath).size - 1)
    if (pm.doc.path(newSiblingAbovePos.toPath()).type == listType) {
      tr.join(newSiblingAbovePos.move(1))
    }

    tr.apply(pm.apply.scroll)
  },
  keys: ["Tab"]
})

// ;; #path=list_item:unindent #kind=command
// If the selection starts and ends in a list item, unindent the selected list items
//
// **Keybindings:** Shift-Tab
ListItem.register("command", "unindent", {
  label: "Unindent the selected list items",
  run(pm) {
    // Make sure that the start and end of the selection is inside list items
    let {from: fromListItemPos, to: toListItemPos} = getListItemSelection(pm)
    if (fromListItemPos == null || toListItemPos == null)
      return false

    let parentPos = fromListItemPos.shorten()

    // Check what kind of selection we have
    let endsInHigherLevel = fromListItemPos.depth > toListItemPos.depth
    let sameParent = Pos.samePath(fromListItemPos.path, toListItemPos.path)

    let liftFrom = fromListItemPos, liftTo
    if (endsInHigherLevel) {
      // We want to unindent all of the subsequent siblings of the start of the selection.
      // Items that are not part of the sibling range are currently ignored. This could be further improved
      // by additionally applying unindent to all selected list items on a higher level in the hierarchy.
      liftTo = new Pos(parentPos.toPath(), pm.doc.path(parentPos.toPath()).size)
    }
    else if (!sameParent) {
      // If the selection ends in a lower level than the start of the selection (a child), only unindent
      // the start item as this will unindent all of its children including the selected children
      liftTo = liftFrom.move(1)
    }
    else {
      // A single list item is selected, only unindent this list item
      liftTo = toListItemPos.move(1)
    }

    let tr = pm.tr
    tr.lift(liftFrom, liftTo)

    // If the list item is not at the top level and it has siblings following it, we need to join
    // the subsequent sibling.
    // This is needed as the subsequent sibling is wrapped in a list after the lift step
    if (fromListItemPos.depth > 1 && pm.doc.path(parentPos.toPath()).size > liftTo.offset) {

      let newParentPos = parentPos.shorten().shorten()
      let unindentedCount = liftTo.offset - liftFrom.offset
      let subsequentSiblingPos = new Pos(newParentPos.toPath(), parentPos.shorten().offset + unindentedCount + 1)
      tr.join(subsequentSiblingPos)
    }

    tr.apply(pm.apply.scroll)
  },
  keys: ["Shift-Tab"]
})

for (let i = 1; i <= 10; i++)
  // ;; #path=:heading::make_ #kind=command
  // The commands `make1` to `make6` set the textblocks in the
  // selection to become headers with the given level.
  //
  // **Keybindings:** Shift-Mod-1 through Shift-Mod-6
  Heading.registerComputed("command", "make" + i, type => {
    let attrs = {level: String(i)}
    if (i <= type.maxLevel) return {
      derive: {name: "make", attrs},
      label: "Change to heading " + i,
      keys: i <= 6 && [`Shift-Mod-${i}`],
      menu: {
        group: "textblockHeading", rank: 30 + i,
        display: {type: "label", label: "Level " + i},
        activeDisplay: "Head " + i
      }
    }
  })

// ;; #path=paragraph:make #kind=command
// Set the textblocks in the selection to be regular paragraphs.
//
// **Keybindings:** Shift-Mod-0
Paragraph.register("command", "make", {
  derive: true,
  label: "Change to paragraph",
  keys: ["Shift-Mod-0"],
  menu: {
    group: "textblock", rank: 10,
    display: {type: "label", label: "Plain"},
    activeDisplay: "Plain"
  }
})

// ;; #path=code_block:make #kind=command
// Set the textblocks in the selection to be code blocks.
//
// **Keybindings:** Shift-Mod-\
CodeBlock.register("command", "make", {
  derive: true,
  label: "Change to code block",
  keys: ["Shift-Mod-\\"],
  menu: {
    group: "textblock", rank: 20,
    display: {type: "label", label: "Code"},
    activeDisplay: "Code"
  }
})

// ;; #path=horizontal_rule:insert #kind=command
// Replace the selection with a horizontal rule.
//
// **Keybindings:** Mod-Shift-Minus
HorizontalRule.register("command", "insert", {
  derive: true,
  label: "Insert horizontal rule",
  keys: ["Mod-Shift--"],
  menu: {group: "insert", rank: 70, display: {type: "label", label: "Horizontal rule"}}
})

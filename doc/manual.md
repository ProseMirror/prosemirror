# ProseMirror user manual

...

## edit Module

This module implements the core editor, and is the main thing you'd
interact with when embedding a ProseMirror instance in a website.

### class edit.ProseMirror <a name="ProseMirror"></a>

This class represents editor instances. It has the following methods
and properties:

**constructor**(options: Object) <a name="ProseMirror.constructor"></a>
  : Construct an editor. The supported options are
    [listed below](#ProseMirror.options).

**doc**: [Node](#Node) <a name="ProseMirror.doc"></a>
  : The current content document. Read-only.

**setContent**(value: Any, format?: string) <a name="ProseMirror.setContent"></a>
  : Replace the document with a new document. The way `value` is
    interpreted depends on the `format` parameter. If this is `null`,
    `value` should be a [`Node`](#Node). Otherwise, it should be a
    valid value for the given [source format type](#FIXME).

**getContent**(format?: string) → Any <a name="ProseMirror.getContent"></a>
  : Retrieve the content document in a given
    [output format type](#FIXME). When `format` is `null`, the
    document is returned as a [`Node`](#Node).

**selection**: [Range](#Range) <a name="ProseMirror.selection"></a>
  : Returns the current selection, as a [`Range`](#Range) object.

**setSelection**(range: [Range](#Range))<br>**setSelection**(anchor: [Pos](#Pos), head: [Pos](#Pos)) <a name="ProseMirror.setSelection"></a>
  : Set a new selection.

**selectedDoc**: [Node](#Node) <a name="ProseMirror.selectedDoc"></a>
  : Get the slice of the document inside the selection.

**selectedText**: string <a name="ProseMirror.selectedText"></a>
  : Get the text inside the current selection.

**apply**(transform: [Transform](#transform.Transform), options?: Object) <a name="ProseMirror.apply"></a>
  : Apply a transformation to the document in the editor. This will
    update the editor's content document and adjust the selection.
    You'll usually want to use the [`tr`](#ProseMirror.tr) getter to
    create such a transform.

**tr**: [Transform](#Transform) <a name="ProseMirror.tr"></a>
  : Create a transform starting at the current document, which you'll
    usually later pass to `apply`(#ProseMirror.apply).

**flush**() <a name="ProseMirror.flush"></a>
  : Flush pending changes to the DOM. This is normally done the next
    time the browser updates the screen, but `flush` can be used to
    do it immediately.

**getOption**(name: string) → Any <a name="ProseMirror.getOption"></a>
  : Get the current value of the named [option](#ProseMirror.options).
  
**setOption**(name: string, value: Any) <a name="ProseMirror.setOption"></a>
  : Set the value of the named [option](#ProseMirror.options). This
    will call the option's [update function](#defineOption) if it has
    one.

**addKeymap**(map: [Keymap](#Keymap), bottom?: bool) <a name="ProseMirror.addKeymap"></a>
  : Add an extra keymap to the editor. By default, the new map has a
    higher precedence than previously registered maps, but if `bottom`
    is given a truthy value, it gets a lower precedence.

**removeKeymap**(map: [Keymap](#Keymap)|string) <a name="ProseMirror.removeKeymap"></a>
  : Remove the given keymap. `map` can be either the [Keymap](#Keymap)
    object itself or a string corresponding to the Keymap's `name`
    option.

**markRange**(from: [Pos](#Pos), to: [Pos](#Pos), options?: Object) → [MarkedRange](#MarkedRange) <a name="ProseMirror.markRange"></a>
  : Create a new marked range, referring to a piece of the document.
    Such a range is a live data structure that tracks the part of the
    document it refers to. The following options are recognized:

    **className**: string
      : Causes the text within the range to be styled with the given
        CSS class.

    **inclusiveLeft**: bool<br>**inclusiveRight**: bool
      : Define whether the start and end of the range are _inclusive_,
        which determines whether text inserted at its boundaries ends
        up inside (inclusive) or outside (non-inclusive) the range.
        The default is to be non-inclusive on both sides.

    **clearWhenEmpty**: bool
      : When on (which is the default), the range will be deleted when
        it becomes empty (all its content is deleted).

**removeRange**(range: [MarkedRange](#MarkedRange)) <a name="ProseMirror.removeRange"></a>
  : Removes the given marked range from the editor. This is a no-op if
    the range is not actually in the editor.

**setStyle**(st: Object, to?: bool) <a name="ProseMirror.setStyle"></a>
  : Change the inline style of the selection. When the selection is
    empty, this influences the current active style at the cursor. If
    something is selected, it influences the whole selection. When
    `to` is `null`, the style will be toggled, when it is `false` it
    is removed, and then `true`, it is added.

**activeStyles**() → [Object] <a name="ProseMirror.activeStyles"></a>
  : Returns the active styles at the cursor position.

**focus**() <a name="ProseMirror.focus"></a>
  : Move focus to the editor.

**hasFocus**() → bool <a name="ProseMirror.hasFocus"></a>
  : Tells you whether the editor currently has focus.

**posAtCoords**(coords: {left, top: number}) → [Pos](#Pos) <a name="ProseMirror.posAtCoords"></a>
  : Given a pair of screen coordinates, returns the position in the
    document closest to those coordinates.

**coordsAtPos**(pos: [Pos](#Pos)) → {left, right, top, bottom: number} <a name="ProseMirror.coordsAtPos"></a>
  : Returns the screen coordinates for a position in the document.

**scrollIntoView**(pos?: [Pos](#Pos)) <a name="ProseMirror.scrollIntoView"></a>
  : Scrolls the given position, or the cursor position if no position
    is given, into view.

**execCommand**(name: string) <a name="ProseMirror.execCommand"></a>
  : Executes the [command](#commands) with the given name, if it
    exists.

#### Supported options <a name="ProseMirror.options"></a>

These are the options
[ProseMirror's constructor](#ProseMirror.constructor) understands by
default. Note that you can use [`defineOption`](#defineOption) to
define new ones.

doc: Any <a name="ProseMirror.options.doc"></a>
  : The editor's starting document. By default, a [`Node`](#Node) is
    expected, but you can use the
    [`docFormat`](#ProseMirror.options.docFormat) option to pass in
    another [supported format](#FIXME).

docFormat: string <a name="ProseMirror.options.docFormat"></a>
  : The [source format](#FIXME) of the
    [`doc` option](#ProseMirror.options.doc).

place: DOM Element <a name="ProseMirror.options.place"></a>
  : The DOM node to append the editor to. Optional.

keymap: [Keymap](#Keymap) <a name="ProseMirror.options.keymap"></a>
  : The base keymap to use. Defaults to the
    [default keymap](#defaultKeymap).

historyDepth: number <a name="ProseMirror.options.historyDepth"></a>
  : The amount of history events to store. Defaults to 50.

historyEventDelay: number <a name="ProseMirror.options.historyEventDelay"></a>
  : The idle time (in milliseconds) that causes a new history event to
    be started. Defaults to 500.

### class edit.Range <a name="Range"></a>

A `Range` object represents a selection, which is determined by a head
and an anchor. Instances of this class provide a few convenience
getters to make working with such ranges easier.

**constructor**(anchor: [Pos](#Pos), head: [Pos](#Pos)) <a name="Range.constructor"></a>
  : Create a selection range.

**anchor**: [Pos](#Pos) <a name="Range.anchor"></a>
  : The range's anchor, which is the side that does not move when you
    press Shift-Left.

**head**: [Pos](#Pos) <a name="Range.head"></a>
  : The range's head, which is its focus point — the side that moves
    when you press Shift-Left.

**inverted**: bool <a name="Range.inverted"></a>
  : Tells you whether the head of the range is before the anchor.

**empty**: bool <a name="Range.empty"></a>
  : True when the head and anchor are the same position.

**from**: [Pos](#Pos) <a name="Range.from"></a>
  : The lowest side of the selection.

**to**: [Pos](#Pos) <a name="Range.to"></a>
  : The highest side of the selection.

### class Keymap <a name="Keymap"></a>

A keymap represents a set of bindings, from single keys or key
sequences to strings ([commands](#commands)) or functions of a single
argument (an editor instance).

**constructor**(bindings: Object, options: Object) <a name="Keymap.constructor"></a>
  : Create a new keymap. The `bindings` object should have key names
    or sequences (such as `"Ctrl-Space"` or `"Ctrl-X F"`) as keys and
    strings or functions as values. These options are supported:

    **fallthrough**: Keymap|[Keymap]
      : Keymaps to fall through to when no binding is found in the
        current map.

    **call**: Function
      : A keymap can be programmatic—rather than enumerating keys, it
        provides a function that, given a key name, computes a
        binding. This is done by specifying a `call` option. It will
        cause the `bindings` parameter to the constructor to be
        ignored.

**addBinding**(keyname: string, value: string|Function) <a name="Keymap.addBinding"></a>
  : Add a new binding to a keymap.

**removeBinding**(keyname: string) <a name="Keymap.removeBinding"></a>
  : Remove a binding from a keymap.

### class MarkedRange <a name="MarkedRange"></a>

A marked range represents a part of the document marked with
[`markRange`](#ProseMirror.markRange).

**from**, **to**: [Pos](#Pos) <a name="MarkedRange.from"></a>
  : The start of the range. Will be updated as the document changes,
    and set to `null` when the range is no longer in the document.

### Further exports

Apart from the classes listed above, the `edit` module also exports
these bindings:

**defineOption**(name: string, defaultValue: Any, update?: Function) #{defineOption}
  : Define a new editor option with the given name and default value.
    If an `update` callback is given, it will be called on
    initialization and every time the option is changed, with
    arguments `(instance: `[`ProseMirror`](#ProseMirror)`, value: Any, oldValue: Any,
    initializing: bool)`.

**registerCommand**(name: string, func: Function)
  : Registers a new [command](#commands). The command's function will
    be called with an editor instance as argument when the command is
    executed.

**eventMixin**(constructor: Function) #{eventMixin}
  : A function that can be applied to a constructor to add the
    following methods to its prototype:

    **on**(event: string, handler: Function) #{on}
      : Register an event handler.

    **off**(event: string, handler: Function) #{off}
      : Remove an event handler.

    **signal**(event: string, ...args) #{signal}
      : Fire an event, passing the given arguments to the event
        handlers.

    **signalHandleable**(event: string, ...args) → Any #{signalHandleable}
      : Fire an event, but stop calling handlers when a handler
        returns a non-`false` value. Return the return value from that
        handler, or `false` if no handler handled the event.

    **hasHandler**(event: string) → bool #{hasHandler}
      : Check whether the object has a handler for the given event.

**defaultKeymap**: [Keymap](#Keymap)
  : The default keymap for ProseMirror editors.

### Commands <a name="commands"></a>

The core editor library defines the following commands, which are
named operations that can be bound to keys or ran with the
[`execCommand`](#ProseMirror.execCommand) method.

**setStrong**, **unsetStrong**, **toggleStrong** (Ctrl/Cmd-B) <a name="command_setStrong"></a>
  : Add, remove, or toggle strong styling for the current selection.
    When no selection is present, the pending styling, which
    determines the style of the next typed character, is changed.

**setEm**, **unsetEm**, **toggleEm** (Ctrl/Cmd-I) <a name="command_setEm"></a>
  : Add, remove, or toggle emphasized styling.

**setCode**, **unsetCode**, **toggleCode** (Ctrl/Cmd-`) <a name="command_setCode"></a>
  : Add, remove, or toggle code font styling.

**endBlock** (Enter) <a name="command_endBlock"></a>
  : End the current block, moving the cursor into a new paragraph
    below it. If the current block is empty, this lifts it out of its
    parent block instead.

**insertHardBreak** (Shift-Enter, Ctrl/Cmd-Enter) <a name="command_insertHardBrack"></a>
  : Insert a hard line break at the cursor.

**delBackward** (Backspace, mac: Ctrl-H) <a name="command_delBackward"></a>
  : Delete before the cursor. If there is a selection, it is deleted.
    If not, and there is text directly before the cursor, one
    character is deleted. If not, and there is a non-editable block
    before the cursor, that is deleted. If not, the current block is
    lifted out of its immediate parent block.

**delWordBackward** (Ctrl/Cmd-Backspace, mac: Alt-Backspace) <a name="command_delWordBackward"></a>
  : Much like `delBackward`, but will delete a whole word when
    deleting text.

**delForward** (Delete, mac: Ctrl-D) <a name="command_delForward"></a>
  : Delete after the cursor. If there is a selection, it is deleted.
    If not, and there is text directly after the cursor, the next
    character is deleted. If not, the block after the cursor is either
    joined to the current block, or, if it is non-editable, deleted
    entirely.

**delWordForward** (Ctrl/Cmd-Delete, mac: Alt-D, Alt-Delete) <a name="command_delWordForward"></a>
  : Similar to `delForward`, but will delete a whole word when
    deleting text.
  
**undo** (Ctrl/Cmd-Z) <a name="command_undo"></a>
  : Reverts the most recent event in the undo history and adds it to
    the redo stack.

**redo** (Ctrl/Cmd-Y, Shift-Ctrl/Cmd-Z) <a name="command_redo"></a>
  : Takes the most recent event from the redo history, if any, and
    reverts it.

**join** (Alt-Up) <a name="command_join"></a>
  : Joins the current block or its nearest joinable ancestor with the
    block before it, if possible.

**lift** (Alt-Left) <a name="command_lift"></a>
  : Lifts the block with the cursor it in it out of its parent block,
    if possible.

**wrapBulletList**, **wrapOrderedList**, **wrapBlockquote** <a name="command_wrap"></a>
  : Wraps the selected blocks in a list or blockquote.

**makeH1**, **makeH2**, **makeH3**, **makeH4**, **makeH5**, **makeH6** <a name="command_makeH"></a>
  : Set the selected blocks to be headings of the given level.

**makeParagraph** (Ctrl/Cmd-P) <a name="command_makeParagraph"></a>
  : Set the selected blocks to be regular paragraphs.

**makeCodeBlock** <a name="command_makeCodeBlock"></a>
  : Set the selected blocks to be code blocks.

**insertRule** <a name="command_insertRule"></a>
  : Insert a horizontal rule element at the cursor.

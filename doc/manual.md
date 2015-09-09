# ProseMirror user manual

...

## Module `edit` <a name="edit"></a>

This module implements the core editor, and is the main thing you'd
interact with when embedding a ProseMirror instance in a website.

### Class `edit.ProseMirror` <a name="ProseMirror"></a>

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

**content**: DOM Element <a name="ProseMirror.content"></a>
  : The DOM node containing the editor's editable content.

**wrapper**: DOM Element <a name="ProseMirror.wrapper"></a>
  : The DOM node wrapping the whole editor.

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

### Class `edit.Range` <a name="Range"></a>

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

### Class `edit.Keymap` <a name="Keymap"></a>

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

### Class `edit.MarkedRange` <a name="MarkedRange"></a>

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

## Module `model` <a name="model"></a>

This module implements the document model. Documents are immutable (by
convention) data structures represented as a tree of [nodes](#Node),
with text-block leaves containing a flat array of [spans](#Span)
representing their content.

### Class `model.Node` <a name="Node"></a>

Nodes make up the structure of a document. They are somewhat like HTML
DOM nodes, but simpler. A node is identified by a type, which
determines the role it has. Each node may have children, though the
schema determines what kind of children, and for many types of nodes
forbids children entirely. Nodes can also have attributes, which again
are constrained by the schema.

**constructor**(type: string|[NodeType](#NodeType), attrs?: Object, content?: [[Node](#Node)] <a name="Node.constructor"></a>
  : Construct a node with the given type, attributes, and content. If
    `attrs` is not given, it will default to the node type's default
    attributes, or raise an error if no suitable defaults exist for
    the node. If `content` is not given, the resulting node is empty.

**type**: [NodeType](#NodeType) <a name="Node.type"></a>
  : The node's type.

**attrs**: Object <a name="Node.attrs"></a>
  : An object containing the node's attributes.

**content**: [[Node](#Node)] <a name="Node.content"></a>
  : The node's children. Exists but is empty for nodes that can not
    have children.

**toString**() → string <a name="Node.toString"></a>
  : Produces a simple human-readable representation of the node.

**copy**(content?: [[Node](#Node)]) → [Node](#Node) <a name="Node.copy"></a>
  : Copies the node, optionally providing a new content array.

**slice**(from: number, to?: number) → [[Node](#Node)] <a name="Node.slice"></a>
  : Returns a slice of the node's content between the two given
    offsets.

**size**: number <a name="Node.size"></a>
  : Returns the total size (in characters/opaque nodes) of this node
    and its children.

**maxOffset**: number <a name="Node.maxOffset"></a>
  : The maximum offset into this node.

**textContent**() → string <a name="Node.textContent"></a>
  : Returns the text in the node as a single string.

**path**(path: [number]) → [Node](#Node) <a name="Node.path"></a>
  : Looks up a node by path, which is an array of offsets. When path
    is `[]`, the current node is returned, when it is `[0]` the first
    child is returned, when `[0, 1]` the second child of the first
    child, and so on.

**pathNodes**(path: [number]) → [[Node](#node)] <a name="Node.pathNodes"></a>
  : Like [`path`](#Node.path), but return an array of nodes that the
    path passes through.

**isValidPos**(pos: [Pos](#Pos), requireInBlock?: bool) → bool <a name="Node.isValidPos"></a>
  : Checks whether the given position points to a valid place in this
    node. If `requireInBlock` is true, the position must point into a
    content block.

**sameMarkup**(other: [Node](#Node)) → bool <a name="Node.sameMarkup"></a>
  : Tells you whether two nodes have the same type and attributes.

**toJSON**() → Object <a name="Node.toJSON"></a>
  : Returns a JSON-serializable representation of the node.

The Node class also has a static method:

**fromJSON**(json: Object) → [Node](#Node) <a name="Node.fromJSON"></a>
  : Given an object as produced by the [`toJSON`](#Node.toJSON)
    method, deserialize it into a proper [`Node`](#Node) object again.

### Class `model.Span` <a name="Span"></a>

Span is a subclass of [Node](#Node) used to represent inline content,
such as text and hard breaks.

**constructor**(type: string|[NodeType](#NodeType), attrs?: Object, styles?: [Object], text?: string) <a name="Span.constructor"></a>
  : Create a span node of the given type. `styles` should be an array
    of style objects, such as [`style.strong`](#style.strong) or a
    value created with [`style.link`](#style.link). `text` should only
    be given when creating a text node.

**text**: string <a name="Span.text"></a>
  : The span's text content (if any).

**styles**: [Object] <a name="Span.styles"></a>
  : An array of style information objects (such 

`Span` has one static method:

**text**(text: string, styles: [Object]) → [Span](#Span) <a name="Span.text"></a>
  : Shorthand for creating a text span.

### Class `model.NodeType` <a name="NodeType"></a>

Node type objects contain information about a node type. FIXME I'm
holding off documenting these properly because they are almost
certainly about to change very much as a result of the schema work.

### Class `model.Pos` <a name="Pos"></a>

Instances of `Pos` represent positions in a document, as an array of
integers that describes a path to the target node (see
[`Node.path`](#Node.path)) and an integer offset. The offset's meaning
depends on the type of the target node. If it contains inline content,
it is a character offset, whereas for nodes containing block nodes, it
is an offset into the [`content`](#Node.content) array.

**constructor**(path: [number], offset: number) <a name="Pos.constructor"></a>
  : Create a position with the given path and offset.

**path**: [number] <a name="Pos.path"></a>
  : The path from the document root to the parent node of this
    position.

**offset**: number <a name="Pos.offset"></a>
  : The offset into the position's parent node.

**toString**() → string <a name="Pos.toString"></a>
  : Returns a simple string representation of the position, in the
    shape of `"0/1:2"` (path `[0, 1]`, offset `2`).

**depth**: number <a name="Pos.depth"></a>
  : The length of the position's path.

**cmp**(other: [Pos](#Pos)) → number <a name="Pos.cmp"></a>
  : Compares two positions. Returns a negative number if `this` is
    before `other`, zero if they are the same, and a positive number
    otherwise.

**shorten**(depth?: number, offset?: number) → [Pos](#Pos) <a name="Pos.shorten"></a>
  : Shorten the path, moving its position closer to the document root.
    By default, it will go one level up, but you can pass `depth` to
    explicitly set the depth of the result. `offset` determines where
    in the parent node the result ends up. If it is 0, you get a
    position directly before the original target node, if it is 1,
    directly after it. Other numbers are also allowed, but might
    create invalid offsets.

**shift**(by: number) → [Pos](#Pos) <a name="Pos.shift"></a>
  : Create a position whose offset is shifted by `by` units compared
    to the original position.

**toJSON**() → Object <a name="Pos.toJSON"></a>
  : Return a JSON-serializable representation of the position.

The class has the following static methods:

**fromJSON**(json: Object) → [Pos](#Pos) <a name="Pos.fromJSON"></a>
  : Convert a JSON object representing a position into an actual
    [`Pos`](#Pos) instance.
  
**start**(doc: [Node](#Node)) → [Pos](#Pos) <a name="Pos.start"></a><br>**end**(doc: [Node](#Node)) → [Pos](#Pos) <a name="Pos.end"></a>
  : Find the first or last inline position in a document.

**after**(doc: [Node](#Node), pos: [Pos](#Pos)) → [Pos](#Pos) <a name="Pos.after"></a><br>**before**(doc: [Node](#Node), pos: [Pos](#Pos)) → [Pos](#Pos) <a name="Pos.before"></a>
  : Find the first inline position before or after `pos` in the given
    document. May return `null` if no such position exists.

**near**(doc: [Node](#Node), pos: [Pos](#Pos)) → [Pos](#Pos) <a name="Pos.near"></a>
  : Find an inline position near `pos` in the given document. Tries
    calling [`after`](#Pos.after) first, and falls back to
    [`before`](#Pos.before) if that fails.
  
### model.style. Submodule <a name="model.style"></a>

This submodule groups style related functionality. Style objects are
used to annotate pieces of inline content. They have a `type` property
holding their type as a string, and may have more properties that
describe the style. A style set is an array of style objects, and
should be treated as immutable.

**strong**: Object <a name="style.strong"></a>
  : Object used for strong text.

**em**: Object <a name="style.em"></a>
  : Object used for emphasized text.

**code**: Object <a name="style.code"></a>
  : Object used for code font style.

**link**(href: string, title?: string) → Object <a name="style.link"></a>
  : Creates a link style object.

**same**(a: Object, b: Object) → bool <a name="style.same"></a>
  : Test whether two styles are the same.

**add**(set: [Object], style: Object) → [Object] <a name="style.add"></a>
  : Adds a style to a set.

**remove**(set: [Object], style: Object) → [Object] <a name="style.remove"></a>
  : Removes a style from a set (if it is in there).

**removeType**(set: [Object], type: string) → [Object] <a name="style.removeType"></a>
  : Remove any style with the given type from a set.

**sameSet**(a: [Object], b: [Object]) → bool <a name="style.sameSet"></a>
  : Test whether two style sets are the same.

**contains**(set: [Object], style: Object) → bool <a name="style.contains"></a>
  : Test whether a style is in a set.

**containsType**(set: [Object], type: string) → bool <a name="style.containsType"></a>
  : Test whether a style with the given type is in a set.

### Further exports

The `model` module exports these further utilities for working with documents:

**sliceBefore**(node: [Node](#Node), to: [Pos](#Pos)) → [Node](#Node) <a name="sliceBefore"></a>
  : Returns the part of a document before a given position.

**sliceAfter**(node: [Node](#Node), from: [Pos](#Pos)) → [Node](#Node) <a name="sliceAfter"></a>
  : Returns the part of a document after a given position.

**sliceBetween**(node: [Node](#Node), from: [Pos](#Pos), to: [Pos](#Pos)) → [Node](#Node) <a name="sliceBetween"></a>
  : Returns the part of a document between two positions.

**findDiffStart**(a: [Node](#Node), b: [Node](#Node)) → [Pos](#Pos) <a name="findDiffStart"></a>
  : Finds the first point at which the two given nodes differ, or
    `null` if they are the same.
  
**findDiffEnd**(a: [Node](#Node), b: [Node](#Node)) → [Pos](#Pos) <a name="findDiffEnd"></a>
  : Finds the last point (scanning from the end) at which the two
    given nodes differ, or `null` if they are the same.
    
**getSpan**(doc: [Node](#Node), pos: [Pos](#Pos)) → [Span](#Span) <a name="getSpan"></a>
  : Finds the span at the given position.
  
**spanStylesAt**(doc: [Node](#Node), pos: [Pos](#Pos)) → [Object] <a name="spanStylesAt"></a>
  : Finds the inline styles at the given position.

**rangeHasStyle**(doc: [Node](#Node), from: [Pos](#Pos), to: [Pos](#Pos), type: string) → bool <a name="rangeHasStyle"></a>
  : Tells you whether a span with a style of the given type exists in
    the part of the document between `from` and `to`.

## Module `transform` <a name="transform"></a>

This module implements various document transformations. The
[`Step`](#Step) class represents such a transformation, which can be
applied (and created) using the [`Transform`](#Transform) class, which
returns a new document and a [position map](#PosMap), wrapped in a
[`TransformResult`](#TransformResult) object.

### Class `transform.Step` <a name="Step"></a>

A step represents and atomic change to a document. You'll want to use
the methods on a [`Transform`](#Transform) instance to create them.

**apply**(doc: [Node](#Node)) → [TransformResult](#TransformResult) <a name="Step.apply"></a>
  : Apply this step, producing either a result, or `null` if the step
    can not be meaningfully applied.

**invert**(oldDoc: [Node](#Node), map: [PosMap](#PosMap)) → [Step](#Step) <a name="Step.invert"></a>
  : Create a step that undoes the change created by this step.
    `oldDoc` should be the document that the step was originally
    applied to, and `map` should be the position map that was created
    by applying the step.
  
**toJSON**() → Object <a name="Step.toJSON"></a>
  : Create a JSON-serializable representation of this step.

Steps have this static method:

**fromJSON**(json: Object) → [Step](#Step) <a name="Step.fromJSON"></a>
  : Given an object that represents this step as JSON, produce an
    actual `Step` instance.

### Class `transform.Transform` <a name="Transform"></a>

A transform object is a helper to create and accumulate a number of
steps that transform a given document. Note that transforming a
document creates a _new_ document, and does not mutate the original
one. Transforming methods on this class return the instance itself, so
that they can be chained.

**constructor**(doc: [Node](#Node)) <a name="Transform.constructor"></a>
  : Start a transformation of the given document.

**doc**: [Node](#Node) <a name="Transform.doc"></a>
  : The current transformed document.

**steps**: [[Step](#Step)] <a name="Transform.steps"></a>
  : The accumulated steps that make up this transformation.

**docs**: [[Node](#Node)] <a name="Transform.docs"></a>
  : An array of intermediate documents. Starts out containing just the
    source document, and has one document added for every step.

**maps**: [[PosMap](#PosMap)] <a name="Transform.maps"></a>
  : The [position maps](#PosMap) produced by the steps in this
    transformation.

**step**(step: [Step](#Step)) → [TransformResult](#TransformResult) <a name="Transform.step"></a>
  : Add a step to this transformation. If it can meaningfully be
    applied, it is added to the [array of steps](#Transform.steps) and
    a [step result](#TransformResult) is returned. If not, `null` is
    returned.

**map**(pos: [Pos](#Pos), bias: number) → [MapResult](#MapResult) <a name="Transform.map"></a>
  : Maps a position that refers to the original document through this
    transformation, so that it refers to the corresponding position in
    the final document.

**delete**(from: [Pos](#Pos), to: [Pos](#Pos)) → [Transform](#Transform) <a name="Transform.delete"></a>
  : Delete the part of the document between the given positions.

**replace**(from: [Pos](#Pos), to: [Pos](#Pos), source: [Node](#Node), start: [Pos](#Pos), end: [Pos](#Pos)) → [Transform](#Transform) <a name="Transform.replace"></a>
  : Replaces the given part of the document with the part of `source`
    between `start` and `end`. Will join compatible nodes at the edges
    (but only if the given positions ‘cut through’ those nodes).

**insert**(pos: [Pos](#Pos), nodes: [Node](#Node)|[[Node](#Node)]) → [Transform](#Transform) <a name="Transform.insert"></a>
  : Insert the given node or nodes at the given position.

**insertInline**(pos: [Pos](#Pos), spans: [Span](#Span)|[[Span](#Span)]) → [Transform](#Transform) <a name="Transform.insertInline"></a>
  : Insert the given spans at the given position, having them inherit
    the styles that exist at the insertion point.
  
**insertText**(pos: [Pos](#Pos), text: string) → [Transform](#Transform) <a name="Transform.insertText"></a>
  : Insert the given text at the given position, inheriting the
    current styles at the insertion point.

**addStyle**(from: [Pos](#Pos), to: [Pos](#Pos), style: Object) → [Transform](#Transform) <a name="Transform.addStyle"></a>
  : Add style `style` to the part of the document between `from` and
    `to`.
  
**removeStyle**(from: [Pos](#Pos), to: [Pos](#Pos), style?: Object|string) → [Transform](#Transform) <a name="Transform.removeStyle"></a>
  : Remove styles from the part of the document between `from` and
    `to`. If `style` is an object, that exact style is removed. If it
    is a string, all types of that type are removed. If it is `null`,
    all styles are removed.

**clearMarkup**(from: [Pos](#Pos), to: [Pos](#Pos)) → [Transform](#Transform) <a name="Transform.clearMarkup"></a>
  : Remove all styles and non-text spans from a part of the document.

**lift**(from: [Pos](#Pos), to?: [Pos](#Pos)) → [Transform](#Transform) <a name="Transform.lift"></a>
  : Lift the blocks covered by the given range (`to` defaults to
    `from`) out of their parent node.
  
**wrap**(from: [Pos](#Pos), to: [Pos](#Pos), nodeType: [Node](#Node)) → [Transform](#Transform) <a name="Transform.wrap"></a>
  : Wrap the blocks covered by the given range in a node of the type
    given by the `nodeType` parameter.

**setBlockType**(from: [Pos](#Pos), to: [Pos](#Pos), nodeType: [Node](#Node)) → [Transform](#Transform) <a name="Transform.setBlockType"></a>
  : Set the type of the blocks covered by the given range the the type
    of the `nodeType` parameter.
  
**join**(at: [Pos](#Pos)) → [Transform](#Transform) <a name="Transform.join"></a>
  : Join the nodes before and after the given position together, if
    possible.

**split**(pos: [Pos](#Pos), depth?: number, nodeType?: [Node](#Node)) → [Transform](#Transform) <a name="Transform.split"></a>
  : Split the node that `pos` points into in two. If `depth` is given
    and more than 1, also split its parent nodes, up to that depth. By
    default, the node after the split inherits the type of the split
    node, but if `nodeType` is passed, that determines the type of the
    new node.

### Class `transform.TransformResult` <a name="TransformResult"></a>

FIXME

### Class `transform.PosMap` <a name="PosMap"></a>

FIXME

### Class `transform.MapResult` <a name="MapResult"></a>

FIXME

### Further exports

FIXME

**canLift**

**canWrap**

**joinPoint**

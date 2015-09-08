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

**selection**: [Range](#Range) <a name="ProseMirror.selection"></a>
  : Returns the current selection, as a [`Range`](#Range) object.

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

**setContent**(value: Any, format?: string) <a name="ProseMirror.setContent"></a>
  : Replace the document with a new document. The way `value` is
    interpreted depends on the `format` parameter. If this is `null`,
    `value` should be a [`Node`](#Node). Otherwise, it should be a
    valid value for the given [source format type](#FIXME).

**getContent**(format?: string) → Any <a name="ProseMirror.getContent"></a>
  : Retrieve the content document in a given
    [output format type](#FIXME). When `format` is `null`, the
    document is returned as a [`Node`](#Node).

**setSelection**(range: [Range](#Range))<br>**setSelection**(anchor: [Pos](#Pos), head: [Pos](#Pos)) <a name="ProseMirror.setSelection"></a>
  : Set a new selection.

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

...

### class Keymap <a name="Keymap"></a>

...

### class MarkedRange <a name="MarkedRange"></a>

...

### Further exports

Apart from the classes listed above, the `edit` module also exports
these bindings:

**defineOption**(name: string, defaultValue: Any, update?: Function) #{defineOption}
  : Define a new editor option with the given name and default value.
    If an `update` callback is given, it will be called on
    initialization and every time the option is changed, with
    arguments `(instance: `[`ProseMirror`](#ProseMirror)`, value: Any, oldValue: Any,
    initializing: bool)`.

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

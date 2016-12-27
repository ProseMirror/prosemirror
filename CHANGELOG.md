## [prosemirror-view](http://prosemirror.net/version/2016.12.23.html#view) 0.16.0 (2016-12-23)

### Bug fixes

Solve problem where setting a node selection would trigger a DOM read, leading to the selection being reset.

## [prosemirror-state](http://prosemirror.net/version/2016.12.23.html#state) 0.16.0 (2016-12-23)

### New features

Plugins now take a [`view` option](http://prosemirror.net/version/2016.12.23.html#state.Plugin.constructor^options.view) that can be used to interact with the [editor view](http://prosemirror.net/version/2016.12.23.html#view.EditorView).

## [prosemirror-view](http://prosemirror.net/version/2016.12.23.html#view) 0.16.0 (2016-12-23)

### Breaking changes

The `spellcheck`, `label`, and `class` props are now replaced by an [`attributes` prop](http://prosemirror.net/version/2016.12.23.html#view.EditorProps.attributes).

### Bug fixes

Ignoring/aborting an action should no longer lead to the DOM being stuck in an outdated state.

Typing at the end of a textblock which ends in a non-text node now actually works.

DOM nodes for leaf document nodes are now set as non-editable to prevent various issues such as stray cursors inside of them and Firefox adding image resize controls.

Inserting a node no longer causes nodes of the same type after it to be neednessly redrawn.

### New features

Add a new editor prop [`editable`](http://prosemirror.net/version/2016.12.23.html#view.EditorProps.editable) which controls whether the editor's `contentEditable` behavior is enabled.

Plugins and props can now set any DOM attribute on the outer editor node using the [`attributes` prop](#view.EditorProps.attributes).

Node view constructors and update methods now have access to the node's wrapping decorations, which can be used to pass information to a node view without encoding it in the document.

Attributes added or removed by node and inline [decorations](http://prosemirror.net/version/2016.12.23.html#view.Decoration) no longer cause the nodes inside of them to be fully redrawn, making node views more stable and allowing CSS transitions to be used.

## [prosemirror-view](http://prosemirror.net/version/2016.12.10.html#view) 0.15.2 (2016-12-10)

### Bug fixes

The native selection is now appropriately hidden when there is a node selection.

## [prosemirror-view](http://prosemirror.net/version/2016.12.10.html#view) 0.15.1 (2016-12-10)

### Bug fixes

Fix DOM parsing for decorated text nodes.

## [prosemirror-model](http://prosemirror.net/version/2016.12.10.html#model) 0.15.0 (2016-12-10)

### Breaking changes

`ResolvedPos.atNodeBoundary` is deprecated and will be removed in the next release. Use `textOffset > 0` instead.

### New features

Parse rules associated with a schema can now specify a [`priority`](http://prosemirror.net/version/2016.12.10.html#model.ParseRule.priority) to influence the order in which they are applied.

Resolved positions have a new getter [`textOffset`](http://prosemirror.net/version/2016.12.10.html#model.ResolvedPos.textOffset) to find their position within a text node (if any).

## [prosemirror-transform](http://prosemirror.net/version/2016.12.10.html#transform) 0.15.0 (2016-12-10)

### Bug fixes

Fix bug where pasted/inserted content would sometimes get incorrectly closed at the right side.

## [prosemirror-state](http://prosemirror.net/version/2016.12.10.html#state) 0.15.0 (2016-12-10)

### Breaking changes

Selection actions no longer scroll the new selection into view by default (they never were supposed to, but due to a bug they did). Add a `scrollIntoView` property to the action to get this behavior.

## [prosemirror-view](http://prosemirror.net/version/2016.12.10.html#view) 0.15.0 (2016-12-10)

### Breaking changes

The editor view no longer wraps its editable DOM element in a wrapper element. The `ProseMirror` CSS class now applies directly to the editable element. The `ProseMirror-content` CSS class is still present for ease of upgrading but will be dropped in the next release.

The editor view no longer draws a drop cursor when dragging content over the editor. The new [`prosemirror-dropcursor`](https://github.com/prosemirror/prosemirror-dropcursor) module implements this as a plugin.

### Bug fixes

Simple typing and backspacing now gets handled by the browser without ProseMirror redrawing the touched nodes, making spell-checking and various platform-specific input tricks (long-press on OS X, double space on iOS) work in the editor.

Improve tracking of DOM nodes that have been touched by user changes, so that [`updateState`](http://prosemirror.net/version/2016.12.10.html#view.EditorView.updateState) can reliably fix them.

Changes to the document that happen while dragging editor content no longer break moving of the content.

Adding or removing a mark directly in the DOM (for example with the bold/italic buttons in iOS' context menu) now produces mark steps, rather than replace steps.

Pressing backspace at the start of a paragraph on Android now allows key handlers for backspace to fire.

Toggling a mark when there is no selection now works better on mobile platforms.

### New features

Introduces an [`endOfTextblock`](http://prosemirror.net/version/2016.12.10.html#view.EditorView.endOfTextblock) method on views, which can be used to find out in a bidi- and layout-aware way whether the selection is on the edge of a textblock.

## [prosemirror-commands](http://prosemirror.net/version/2016.12.10.html#commands) 0.15.0 (2016-12-10)

### Breaking changes

Drops suppport for `delete(Char|Word)(Before|After)` and `move(Back|For)ward`, since we are now letting the browser handle those natively.

### Bug fixes

The [`joinForward`](http://prosemirror.net/version/2016.12.10.html#commands.joinForward) and [`joinBackward`](http://prosemirror.net/version/2016.12.10.html#commands.joinBackward) commands can now strip out markup and nodes that aren't allowed in the joined node.

### New features

A new command [`exitCode`](http://prosemirror.net/version/2016.12.10.html#commands.exitCode) allows a user to exit a code block by creating a new paragraph below it.

The [`joinForward`](http://prosemirror.net/version/2016.12.10.html#commands.joinForward) and [`joinBackward`](http://prosemirror.net/version/2016.12.10.html#commands.joinBackward) commands now use a bidirectional-text-aware way to determine whether the cursor is at the proper side of its parent textblock when they are passed a view.

## [prosemirror-view](http://prosemirror.net/version/2016.11.28.html#view) 0.14.4 (2016-12-02)

### Bug fixes

Fix issue where node decorations would stick around in the DOM after the decoration was removed.

Setting or removing a node selection in an unfocused editor now properly updates the DOM to show that selection.

## [prosemirror-model](http://prosemirror.net/version/2016.11.28.html#model) 0.14.1 (2016-11-30)

### Bug fixes

[`DOMParser.parseSlice`](http://prosemirror.net/version/2016.11.28.html#model.DOMParser.parseSlice) will now ignore whitespace-only text nodes at the top of the slice.

## [prosemirror-view](http://prosemirror.net/version/2016.11.28.html#view) 0.14.2 (2016-11-30)

### Bug fixes

FIX: Avoid unneeded selection resets which sometimes confused browsers.

## [prosemirror-view](http://prosemirror.net/version/2016.11.28.html#view) 0.14.2 (2016-11-29)

### Bug fixes

Fix a bug where inverted selections weren't created in the DOM correctly.

## [prosemirror-view](http://prosemirror.net/version/2016.11.28.html#view) 0.14.1 (2016-11-29)

### Bug fixes

Restores previously broken kludge that allows the cursor to appear after non-text content at the end of a line.

## [prosemirror-model](http://prosemirror.net/version/2016.11.28.html#model) 0.14.0 (2016-11-28)

### New features

Parse rules now support [`skip`](http://prosemirror.net/version/2016.11.28.html#model.ParseRule.skip) (skip outer element, parse content) and [`getContent`](http://prosemirror.net/version/2016.11.28.html#model.ParseRule.getContent) (compute content using custom code) properties.

The `DOMSerializer` class now exports a static [`renderSpec`](http://prosemirror.net/version/2016.11.28.html#model.DOMSerializer^renderSpec) method that can help render DOM spec arrays.

## [prosemirror-state](http://prosemirror.net/version/2016.11.28.html#state) 0.14.0 (2016-11-28)

### New features

[Selection actions](http://prosemirror.net/version/2016.11.28.html#state.SelectionAction) now have a `time` field and an (optional) `origin` field.

## [prosemirror-view](http://prosemirror.net/version/2016.11.28.html#view) 0.14.0 (2016-11-28)

### Breaking changes

Wrapping decorations are now created using the [`nodeName`](http://prosemirror.net/version/2016.11.28.html#view.DecorationAttrs.nodeName) property. The `wrapper` property is no longer supported.

The `onUnmountDOM` prop is no longer supported (use a node view with a [`destroy`](http://prosemirror.net/version/2016.11.28.html#view.NodeView.destroy) method instead).

The `domSerializer` prop is no longer supported. Use [node views](http://prosemirror.net/version/2016.11.28.html#view.EditorProps.nodeViews) to configure editor-specific node representations.

### New features

Widget decorations can now be given a [`key`](http://prosemirror.net/version/2016.11.28.html#view.Decoration.widget^options.key) property to prevent unneccesary redraws.

The `EditorView` class now has a [`destroy`](http://prosemirror.net/version/2016.11.28.html#view.EditorView.destroy) method for cleaning up.

The [`handleClickOn`](http://prosemirror.net/version/2016.11.28.html#view.EditorProps.handleClickOn) prop and friends now receive a `direct` boolean argument that indicates whether the node was clicked directly.

[Widget decorations](http://prosemirror.net/version/2016.11.28.html#view.Decoration^widget) now support a `stopEvent` option that can be used to control which DOM events that pass through them should be ignored by the editor view.

You can now [specify](http://prosemirror.net/version/2016.11.28.html#view.EditorProps.nodeViews) custom [node views](http://prosemirror.net/version/2016.11.28.html#view.NodeView) for an editor view, which give you control over the way node of a given type are represented in the DOM. See the related [RFC](https://discuss.prosemirror.net/t/rfc-node-views-to-manage-the-representation-of-nodes/463).

## [prosemirror-view](http://prosemirror.net/version/2016.11.11.html#view) 0.13.2 (2016-11-15)

### Bug fixes

Fixes an issue where widget decorations in the middle of text nodes would sometimes disappear.

## [prosemirror-view](http://prosemirror.net/version/2016.11.11.html#view) 0.13.1 (2016-11-15)

### Bug fixes

Fixes event handler crash (and subsequent bad default behavior) when pasting some types of external HTML into an editor.

## [prosemirror-model](http://prosemirror.net/version/2016.11.11.html#model) 0.13.0 (2016-11-11)

### Breaking changes

`ResolvedPos.sameDepth` is now called [`ResolvedPos.sharedDepth`](http://prosemirror.net/version/2016.11.11.html#model.ResolvedPos.sharedDepth), and takes a raw, unresolved position as argument.

### New features

[`DOMSerializer`](http://prosemirror.net/version/2016.11.11.html#model.DOMSerializer)'s `nodes` and `marks` properties are now public.

[`ContentMatch.findWrapping`](http://prosemirror.net/version/2016.11.11.html#model.ContentMatch.findWrapping) now takes a third argument, `marks`. There's a new method [`findWrappingFor`](http://prosemirror.net/version/2016.11.11.html#model.ContentMatch.findWrappingFor) that accepts a whole node.

Adds [`Slice.maxOpen`](http://prosemirror.net/version/2016.11.11.html#model.Slice^maxOpen) static method to create maximally open slices.

DOM parser objects now have a [`parseSlice`](http://prosemirror.net/version/2016.11.11.html#model.DOMParser.parseSlice) method which parses an HTML fragment into a [`Slice`](http://prosemirror.net/version/2016.11.11.html#model.Slice), rather than trying to create a whole document from it.

## [prosemirror-transform](http://prosemirror.net/version/2016.11.11.html#transform) 0.13.0 (2016-11-11)

### Bug fixes

Fix issue where [`Transform.replace`](http://prosemirror.net/version/2016.11.11.html#transform.Transform.replace) would, in specific circumstances, unneccessarily drop content.

### New features

The new [`Transform`](http://prosemirror.net/version/2016.11.11.html#transform.Transform) method [`replaceRange`](http://prosemirror.net/version/2016.11.11.html#transform.Transform.replaceRange), [`replaceRangeWith`](http://prosemirror.net/version/2016.11.11.html#transform.Transform.replaceRangeWith), and [`deleteRange`](http://prosemirror.net/version/2016.11.11.html#transform.Transform.deleteRange) provide a way to replace and delete content in a 'do what I mean' way, automatically expanding the replaced region over empty parent nodes and including the parent nodes in the inserted content when appropriate.

## [prosemirror-state](http://prosemirror.net/version/2016.11.11.html#state) 0.13.0 (2016-11-11)

### Breaking changes

[`EditorTransform.replaceSelection`](http://prosemirror.net/version/2016.11.11.html#state.EditorTransform.replaceSelection) now takes a [slice](http://prosemirror.net/version/2016.11.11.html#model.Slice), no longer a node. The new [`replaceSelectionWith`](http://prosemirror.net/version/2016.11.11.html#state.EditorTransform.replaceSelectionWith) method should be used to replace the selection with a node. Until the next release, calling it the old way will still work and emit a warning.

### Bug fixes

The documentation for [`applyAction`](#state.StateField.applyAction) now actually reflects the arguments this method is given.

### New features

A state field's [`applyAction`](#state.StateField.applyAction) method is now passed the previous state as 4th argument, so that it has access to the new doc and selection.

[`EditorTransform.replaceSelection`](http://prosemirror.net/version/2016.11.11.html#state.EditorTransform.replaceSelection) now accepts a slice (or, as before, as a node), and uses a revised algorithm, relying on the [`defining`](http://prosemirror.net/version/2016.11.11.html#model.NodeSpec.defining) node flag.

The [`TextSelection`](http://prosemirror.net/version/2016.11.11.html#state.TextSelection) and [`NodeSelection`](http://prosemirror.net/version/2016.11.11.html#state.NodeSelection) classes now have a static [`create`](http://prosemirror.net/version/2016.11.11.html#state.TextSelection^create) convenience method for creating selections from unresolved positions.

Allow [transform actions](http://prosemirror.net/version/2016.11.11.html#state.TransformAction) to be extended during dispatch using [`extendTransformAction`](http://prosemirror.net/version/2016.11.11.html#state.extendTransformAction). Introduce [`sealed`](http://prosemirror.net/version/2016.11.11.html#state.TransformAction.sealed) flag to indicate when this is not safe.

A new utility function [`NodeSelection.isSelectable`](http://prosemirror.net/version/2016.11.11.html#state.NodeSelection.isSelectable) can be used to test whether a node can be the target of a node selection.

## [prosemirror-view](http://prosemirror.net/version/2016.11.11.html#view) 0.13.0 (2016-11-11)

### Breaking changes

Selecting nodes on OS X is now done with cmd-leftclick rather than ctrl-leftclick.

### Bug fixes

Pasting text into a code block will now insert the raw text.

Widget decorations at the start or end of a textblock no longer block horizontal cursor motion through them.

Widget nodes at the end of textblocks are now reliably drawn during display updates.

### New features

[`DecorationSet.map`](http://prosemirror.net/version/2016.11.11.html#view.DecorationSet.map) now takes an options object which allows you to specify an `onRemove` callback to be notified when remapping drops decorations.

The [`transformPastedHTML`](http://prosemirror.net/version/2016.11.11.html#view.EditorProps.transformPastedHTML) and [`transformPastedText`](http://prosemirror.net/version/2016.11.11.html#view.EditorProps.transformPastedText) props were (re-)added, and can be used to clean up pasted content.

## [prosemirror-commands](http://prosemirror.net/version/2016.11.11.html#commands) 0.13.0 (2016-11-11)

### New features

The [`autoJoin`](http://prosemirror.net/version/2016.11.11.html#commands.autoJoin) function allows you to wrap command functions so that when the command makes nodes of a certain type occur next to each other, they are automatically joined.

## [prosemirror-view](http://prosemirror.net/version/2016.10.21.html#view) 0.12.2 (2016-11-02)

### Bug fixes

Inline decorations that span across an empty textblock no longer crash the display drawing code.

## [prosemirror-view](http://prosemirror.net/version/2016.10.21.html#view) 0.12.1 (2016-11-01)

### Bug fixes

Use a separate document to parse pasted HTML to better protect
against cross-site scripting attacks.

Specifying multiple classes in a decoration now actually works.

Ignore empty inline decorations when building a decoration set.

## [prosemirror-history](http://prosemirror.net/version/2016.10.21.html#history) 0.12.1 (2016-11-01)

### Bug fixes

Fix crash in undo or redo commands when the history is empty.

## [prosemirror-transform](http://prosemirror.net/version/2016.10.21.html#transform) 0.12.1 (2016-11-01)

### Bug fixes

Fix bug in `Transform.setBlockType` when used in a transform that already has steps.

## [prosemirror-model](http://prosemirror.net/version/2016.10.21.html#model) 0.12.0 (2016-10-21)

### Breaking changes

Drops support for some undocumented options to the DOM
serializer that were used by the view.

### Bug fixes

When rendering DOM attributes, only ignore null values, not all
falsy values.

## [prosemirror-transform](http://prosemirror.net/version/2016.10.21.html#transform) 0.12.0 (2016-10-21)

### Breaking changes

Mapped positions now count as deleted when the token to the
side specified by the `assoc` parameter is deleted, rather than when
both tokens around them are deleted. (This is usually what you already
wanted anyway.)

## [prosemirror-state](http://prosemirror.net/version/2016.10.21.html#state) 0.12.0 (2016-10-21)

### Breaking changes

The interace to
[`EditorState.toJSON`](http://prosemirror.net/version/2016.10.21.html#state.EditorState.toJSON) and
[`EditorState.fromJSON`](http://prosemirror.net/version/2016.10.21.html#state.EditorState.fromJSON) has changed.

The way plugins declare their [state
field](http://prosemirror.net/version/2016.10.21.html#state.Plugin.constructor.options.state) has changed. Only one
state field per plugin is supported, and state fields no longer have
hard-coded names. [`Plugin.getState`](http://prosemirror.net/version/2016.10.21.html#state.Plugin.getState) is the
way to access plugin state now.

Plugin dependencies are no longer supported.

`Plugin.reconfigure` is gone. Plugins are now always created
with [`new Plugin`](http://prosemirror.net/version/2016.10.21.html#state.Plugin.constructor).

Plugins no longer have a `config` field.

### Bug fixes

Node selections are now properly dropped when mapped over a
change that replaces their nodes.

### New features

[Plugin keys](http://prosemirror.net/version/2016.10.21.html#state.PluginKey) can now be used to find
plugins by identity.

[Transform actions](http://prosemirror.net/version/2016.10.21.html#state.TransformAction) now have a
`time` field containing the timestamp when the change was made.

## [prosemirror-view](http://prosemirror.net/version/2016.10.21.html#view) 0.12.0 (2016-10-21)

### Breaking changes

The return value of
[`EditorView.posAtCoords`](http://prosemirror.net/version/2016.10.21.html#view.EditorView.posAtCoords) changed to
contain an `inside` property pointing at the innermost node that the
coordinates are inside of. (Note that the docs for this method were
wrong in the previous release.)

### Bug fixes

Reduce reliance on shift-state tracking to minimize damage when
it gets out of sync.

Fix bug that'd produce bogus document positions for DOM positions
inside non-document nodes.

Don't treat fast ctrl-clicks as double or triple clicks.

### New features

Implement [decorations](http://prosemirror.net/version/2016.10.21.html#view.Decoration), a way to
influence the way the document is drawn. Add the [`decorations`
prop](http://prosemirror.net/version/2016.10.21.html#view.EditorProps.decorations) to specify them.

## [prosemirror-keymap](http://prosemirror.net/version/2016.10.21.html#keymap) 0.12.0 (2016-10-21)

### Breaking changes

Key names are now based on
[`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)
instead of
[`.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code).
This means that, for character-producing keys, you'll want to use the
character typed, not the key name. So `Ctrl-Z` now means uppercase Z,
and you'll usually want `Ctrl-z` instead. Single-quoted key names are
no longer supported.

## [prosemirror-history](http://prosemirror.net/version/2016.10.21.html#history) 0.12.0 (2016-10-21)

### Breaking changes

The [`history`](http://prosemirror.net/version/2016.10.21.html#history.history) export is now a function
that creates a history plugin, rather than a plugin instance.

### New features

Add a
[`newGroupDelay`](http://prosemirror.net/version/2016.10.21.html#history.history^config.newGroupDelay) plugin
option. This brings back the behavior where pausing between edits will
automatically cause the history to put subsequent changes in a new
undo event.

## [prosemirror-commands](http://prosemirror.net/version/2016.10.21.html#commands) 0.12.0 (2016-10-21)

### Bug fixes

Fix crash when backspacing into nodes with complex content
expressions.

## [prosemirror-schema-basic](http://prosemirror.net/version/2016.10.21.html#schema-basic) 0.12.0 (2016-10-21)

### Bug fixes

Don't treat \<b style=font-weight: normal> as strong when parsing.
(Google Docs puts such ridiculous HTML on the clipboard.)

## [prosemirror-view](http://prosemirror.net/version/2016.09.21.html#view) 0.11.2 (2016-10-04)

### Bug fixes

Pass actual event object to [`handleDOMEvent`](http://prosemirror.net/version/2016.09.21.html#view.EditorProps.handleDOMEvent), rather than just its name.

Fix display corruption caused by using the wrong state as previous version during IME.

## [prosemirror-model](http://prosemirror.net/version/2016.09.21.html#model) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

The JSON representation of [marks](http://prosemirror.net/version/2016.09.21.html#model.Mark) has changed from
`{"_": "type", "attr1": "value"}` to `{"type": "type", "attrs":
{"attr1": "value"}}`, where `attrs` may be omitted when the mark has
no attributes.

Mark-related JSON methods now live on the
[`Mark` class](http://prosemirror.net/version/2016.09.21.html#model.Mark^fromJSON).

The way node and mark types in a schema are defined was changed from
defining subclasses to passing plain objects
([`NodeSpec`](http://prosemirror.net/version/2016.09.21.html#model.NodeSpec) and [`MarkSpec`](http://prosemirror.net/version/2016.09.21.html#model.MarkSpec)).

DOM serialization and parsing logic is now done through dedicated
objects ([`DOMSerializer`](http://prosemirror.net/version/2016.09.21.html#model.DOMSerializer) and
[`DOMParser`](http://prosemirror.net/version/2016.09.21.html#model.DOMParser)), rather than through the schema. It
is now possible to define alternative parsing and serializing
strategies without touching the schema.

### New features

The [`Slice`](http://prosemirror.net/version/2016.09.21.html#model.Slice) class now has an [`eq` method](http://prosemirror.net/version/2016.09.21.html#model.Slice.eq).

The [`Node.marksAt`](http://prosemirror.net/version/2016.09.21.html#model.Node.marksAt) method got a second
parameter to indicate you're interested in the marks _after_ the
position.

## [prosemirror-transform](http://prosemirror.net/version/2016.09.21.html#transform) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

The `Remapping` class was renamed to `Mapping` and works differently
(simpler, grows in only one direction, and has provision for mapping
through only a part of it).

[`Transform`](http://prosemirror.net/version/2016.09.21.html#transform.Transform) objects now build up a `Mapping`
instead of an array of maps.

`PosMap` was renamed to [`StepMap`](http://prosemirror.net/version/2016.09.21.html#transform.StepMap) to make it
clearer that this applies only to a single step (as opposed to
[`Mapping`](http://prosemirror.net/version/2016.09.21.html#transform.Mapping).

The arguments to [`canSplit`](http://prosemirror.net/version/2016.09.21.html#transform.canSplit) and
[`split`](http://prosemirror.net/version/2016.09.21.html#transform.Transform.split) were changed to make it
possible to specify multiple split-off node types for splits with a
depth greater than 1.

Rename `joinable` to [`canJoin`](http://prosemirror.net/version/2016.09.21.html#transform.canJoin).

### New features

Steps can now be [merged](http://prosemirror.net/version/2016.09.21.html#transform.Step.merge) in some
circumstances, which can be useful when storing a lot of them.

## [prosemirror-state](http://prosemirror.net/version/2016.09.21.html#state) 0.11.0 (2016-09-21)

### Breaking changes

New module inheriting the [`Selection`](http://prosemirror.net/version/2016.09.21.html#state.Selection) and
[`EditorTransform`](http://prosemirror.net/version/2016.09.21.html#state.EditorTransform) abstraction, along with
the persistent [state](http://prosemirror.net/version/2016.09.21.html#state.EditorState) value that is now separate
from the display logic, and the [plugin](http://prosemirror.net/version/2016.09.21.html#state.Plugin) system.

`Selection.findAtStart`/`End` was renamed to
[`Selection.atStart`](http://prosemirror.net/version/2016.09.21.html#state.Selection^atStart)/[`End`](http://prosemirror.net/version/2016.09.21.html#state.Selection^atEnd),
and `Selection.findNear` to
[`Selection.near`](http://prosemirror.net/version/2016.09.21.html#state.Selection^near).

## [prosemirror-view](http://prosemirror.net/version/2016.09.21.html#view) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module from the old `edit` submodule. Completely
new approach to managing the editor's DOM representation and input.

Event handlers and options are now replaced by
[props](http://prosemirror.net/version/2016.09.21.html#view.EditorProps). The view's state is now 'shallow',
represented entirely by a set of props, one of which holds an editor
state value from the [state](http://prosemirror.net/version/2016.09.21.html#state) module.

When the user interacts with the editor, it will pass an
[action](http://prosemirror.net/version/2016.09.21.html#state.Action) to its
[`onAction`](http://prosemirror.net/version/2016.09.21.html#view.EditorProps.onAction) prop, which is responsible
for triggering an view update.

The `markRange` system was dropped, to be replaced in the next release
by a 'decoration' system.

There is no keymap support in the view module anymore. Use a
[keymap](http://prosemirror.net/version/2016.09.21.html#keymap) plugin for that.

The undo [history](http://prosemirror.net/version/2016.09.21.html#history) is now a separate plugin.

CSS needed by the editor is no longer injected implicitly into the
page. Instead, you should arrange for the `style/prosemirror.css` file
to be loaded into your page.

### New features

The DOM [parser](http://prosemirror.net/version/2016.09.21.html#model.DOMParser) and
[serializer](http://prosemirror.net/version/2016.09.21.html#model.DOMSerializer) used to interact with the visible
DOM and the clipboard can now be customized through
[props](http://prosemirror.net/version/2016.09.21.html#view.EditorProps).

You can now provide a catch-all DOM
[event handler](http://prosemirror.net/version/2016.09.21.html#view.EditorProps.handleDOMEvent) to get a first
chance at handling DOM events.

The [`onUnmountDOM`](http://prosemirror.net/version/2016.09.21.html#view.EditorProps.onUnmountDOM) can be used to
be notified when a piece of the document DOM is thrown away (in case
cleanup is needed).

## [prosemirror-keymap](http://prosemirror.net/version/2016.09.21.html#keymap) 0.11.0 (2016-09-21)

### Breaking changes

New module, takes the same role as the old built-in keymap support in
the `ProseMirror` class.

## [prosemirror-inputrules](http://prosemirror.net/version/2016.09.21.html#inputrules) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

You can now add this plugin multiple times to add different sets of
rules to an editor (if you want). It is not possible to change the set
of rules of an existing plugin instance.

[Rules](http://prosemirror.net/version/2016.09.21.html#inputrules.InputRule) no longer take a `filter` argument.

The signature of the `handler` callback for a
[rule](http://prosemirror.net/version/2016.09.21.html#inputrules.InputRule) changed.

## [prosemirror-history](http://prosemirror.net/version/2016.09.21.html#history) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module. Now acts as a plugin that can be omitted
or replaced by a different implementation if desired.

Merging subsequent changes into a single undo 'event' is now done by
proximity in the document (the changes must touch) rather than in
time. This will probably have to be further refined.

## [prosemirror-collab](http://prosemirror.net/version/2016.09.21.html#collab) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

Interface [adjusted](http://prosemirror.net/version/2016.09.21.html#collab) to work with the new
[plugin](http://prosemirror.net/version/2016.09.21.html#state.Plugin) system.

### New features

When receiving changes, the module now
[generates](http://prosemirror.net/version/2016.09.21.html#collab.receiveAction) a regular
[transform action](http://prosemirror.net/version/2016.09.21.html#state.TransformAction) instead of hard-setting
the editor's document. This solves problematic corner cases for code
keeping track of the document by listening to transform actions.

## [prosemirror-commands](http://prosemirror.net/version/2016.09.21.html#commands) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

The interface for command functions was changed to work with the new
[state](http://prosemirror.net/version/2016.09.21.html#state.EditorState)/[action](http://prosemirror.net/version/2016.09.21.html#state.Action) abstractions.

## [prosemirror-schema-basic](http://prosemirror.net/version/2016.09.21.html#schema-basic) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

No longer exports the [specs](http://prosemirror.net/version/2016.09.21.html#model.NodeSpec) for the nodes and
marks separately, since they are now plain objects, not subclasses.
They are still exported through [nodes](http://prosemirror.net/version/2016.09.21.html#schema-basic.nodes) and
[marks](http://prosemirror.net/version/2016.09.21.html#schema-basic.marks) objects.

The list-related nodes were moved to the [schema-list](http://prosemirror.net/version/2016.09.21.html#schema-list)
module.

## [prosemirror-schema-list](http://prosemirror.net/version/2016.09.21.html#schema-list) 0.11.0 (2016-09-21)

### Breaking changes

New module combining the node [specs](http://prosemirror.net/version/2016.09.21.html#model.NodeSpec) from
[schema-basic](http://prosemirror.net/version/2016.09.21.html#schema-basic), and the list-related
[commands](http://prosemirror.net/version/2016.09.21.html#commands) from the commands module.

## [prosemirror-schema-table](http://prosemirror.net/version/2016.09.21.html#schema-table) 0.11.0 (2016-09-21)

### Breaking changes

Moved into a separate module.

Node types adjusted to the new [node spec](http://prosemirror.net/version/2016.09.21.html#model.NodeSpec)
interface.

Commands adjusted to the new [command](http://prosemirror.net/version/2016.09.21.html#commands) interface.

## 0.10.1 (2016-09-12)

### Bug fixes

Fixes a problem where the DOM parser would produce corrupted documents
in some corner cases.

Makes the editor useable on IE again by not assuming `document` has a
`contains` method.

## 0.10.0 (2016-08-26)

### Bug fixes

Fixed several issues in the handling of clicks on and near leaf nodes.

Fix bug where
[`liftTarget`](http://prosemirror.net/ref.html#liftTarget) would
produce false positives.

Improve support for using ProseMirror in a shadow DOM.

### New features

The
[`ProseMirror.on.domPaste`](http://prosemirror.net/ref.html#ProseMirror.on.domPaste)
event can now be used to entirely override the handling of paste
events.

The new
[`ProseMirror.root`](http://prosemirror.net/ref.html#ProseMirror.root)
property returns the document or shadow DOM root that the editor is
part of.

New method
[`PosMap.forEach`](http://prosemirror.net/ref.html#PosMap.forEach) to
easily iterate over the changed ranges in a position map.

[Marked ranges](http://prosemirror.net/ref.html#ProseMirror.markRange)
now support an `elementBefore` option to insert a DOM node before the
range.

## 0.9.1 (2016-07-29)

### Bug fixes

Fix DOM node leak in the creation of menu SVG icons.

Fix regression where `clickOn` and `doubleClickOn` handlers weren't
called on clicked leaf nodes.

Fix crash in DOM parser when parsing a DOM change.

## 0.9.0 (2016-07-26)

### Bug fixes

Pasting a single leaf node (a node that doesn't allow content) works
again.

Parsing Markdown text with code blocks (indented or fenced) works again.

Fixes a bug where clicking a selectable leaf node would create a
selection before that node.

Fix the way `requestAnimationFrame` is called to please Internet
Explorer.

### New features

Mouse-related event handlers (`click`, `clickOn`, `doubleClick`,
`doubleClickOn`, `contextMenu`) are now passed the original DOM event.

Adds a new module `schema-tables`, that exports node types and
commands for tables, along with a way to easily add them to your
schema.

## 0.8.3 (2016-06-28)

### Bug fixes

When pasting text, assign some basic structure to it by inserting
`<p>` and `<br>` tags.

Fix a bug in `EditorTranform.selection`.

Disable the `setBlockType` command for non-textblock blocks.

Make `splitBlock` handle content restrictions better.

## 0.8.2 (2016-06-21)

### Bug fixes

Fix `OrderedMap.append` and `OrderedMap.prepend` to allow raw-object
arguments.

Fix bug where `Node.textContent` didn't actually return a value.

Make the `wrapInList` command more robust in the face of schema
constraints.

## 0.8.1 (2016-06-16)

### Bug fixes

Fixes `addActiveMark` and `removeActiveMark` ignoring marks from the
document, and thus accidentally resetting the set of marks when used.

Properly export the parser, serializer, and state classes from the
`markdown` module.

## 0.8.0 (2016-06-15)

### Breaking changes

The `src/` directory no longer uses ES6 modules, and is now
CommonJS-based instead. With ES6 support—_except_ for modules—being
pretty much complete in browsers and node, that was the only thing
holding us back from running the code directly, without compilation.

There is no longer a default schema in the `model` module. The new
[`schema-basic`](http://prosemirror.net/version/0.8.0.html#schema-basic) module exports the schema, node
types, and mark types that used to make up the default schema.

The [`schema`](http://prosemirror.net/version/0.8.0.html#option_schema) option is no longer optional (though
it is implied if you pass a [`doc`](http://prosemirror.net/version/0.8.0.html#option_doc) option).

The `Command` abstraction was entirely removed. When the docs talk
about _commands_ now, they refer to plain functions that take an
editor instance as argument and return a boolean indicating whether
they could perform their action.

Keymaps now map keys to such command functions. The basic keymap for
an editor is no longer inferred from commands, but is now determined
by the [`keymap`](http://prosemirror.net/version/0.8.0.html#option_keymap) option. The
[default value](http://prosemirror.net/version/0.8.0.html#baseKeymap) contains a minimal set of bindings not
related to any schema elements.

Defining new options is no longer a thing. Modules that used to use
`defineOption` now export [plugins](http://prosemirror.net/version/0.8.0.html#Plugin).

Changing options at run-time through `setOption` is no longer
supported, since the remaining built-in options don't require this.

The `docFormat` option, `getContent`/`setContent` editor methods, and
the `format` module have been dropped. You need to explicitly convert
between formats yourself now.

The DOM parsing and serializing from the `format` module was moved
into the `model` module, as the [`toDOM`](http://prosemirror.net/version/0.8.0.html#Fragment.toDOM) and
[`parseDOM`](http://prosemirror.net/version/0.8.0.html#Schema.parseDOM) methods.

The conversions to and from text and HTML were dropped. HTML can be
done by going through the DOM representation, the text format
conversions were never very well defined to begin with.

Declaring the way a node or mark type is parsed or serialized was
simplified. See the new [`toDOM`](http://prosemirror.net/version/0.8.0.html#NodeType.toDOM),
[`matchDOMTag`](http://prosemirror.net/version/0.8.0.html#NodeType.matchDOMTag) and
[`matchDOMStyle`](http://prosemirror.net/version/0.8.0.html#MarkType.matchDOMStyle) properties.

The `SchemaItem` class, along with the `register` and `updateAttrs`
static methods on that class, have been removed. `NodeType` and
`MarkType` no longer share a superclass, and registering values on
such types is no longer a thing.

`Textblock` is no longer a class that you derive node type classes
from. Just use `Block`, and the `isTextblock` getter will return the
right value based on the node type's content.

Event handlers are no longer registered with node-style `on` methods,
but attached to specific values representing an event source. The
[subscription](https://github.com/marijnh/subscription#readme) module
is used for this. The event emitters for an editor instance are
grouped in its [`on`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on) property. So now you'd say
`pm.on.change.add(...)` to register a change handler.

The event-like node type methods `handleClick`, `handleDoubleClick`,
and `handleContextMenu` are no longer supported. Instead, you're
expected to use the [`click`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on.click),
[`clickOn`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on.clickOn),
[`doubleClick`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on.doubleClick),
[`doubleClickOn`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on.doubleClickOn), and
[`contextMenu`](http://prosemirror.net/version/0.8.0.html#ProseMirror.on.contextMenu) event emitters.

The `removed` event on [marked ranges](http://prosemirror.net/version/0.8.0.html#MarkedRange) was replaced by
an `onRemove` option.

The [`apply`](http://prosemirror.net/version/0.8.0.html#ProseMirror.apply) method on an editor now always
returns the transform, whereas it used to return `false` if no change
was made. Its `scroll` property (containing a commonly used options
object) was removed.

The `checkPos` method on editor objects was removed.

The `rank` argument to [`addKeymap`](http://prosemirror.net/version/0.8.0.html#ProseMirror.addKeymap) was
renamed `priority` and its meaning was inverted.

The `setMark` method on editor instances was removed. Its role is
mostly taken over by the [`toggleMark`](http://prosemirror.net/version/0.8.0.html#commands.toggleMark)
command.

The functionality from the `ui/update` module was moved into the
`edit` module and is now available through the
[`scheduleDOMUpdate`](http://prosemirror.net/version/0.8.0.html#ProseMirror.scheduleDOMUpdate),
[`unscheduleDOMUpdate`](http://prosemirror.net/version/0.8.0.html#ProseMirror.unscheduleDOMUpdate), and
[`updateScheduler`](http://prosemirror.net/version/0.8.0.html#ProseMirror.updateScheduler) methods.

[Selection](http://prosemirror.net/version/0.8.0.html#Selection) objects now contain [resolved](http://prosemirror.net/version/0.8.0.html#ResolvedPos)
positions, because that's what you need 99% of the time when you
access them. Their old properties are still there, in addition to
`$from`, `$to`, `$anchor`, and `$head` properties. The constructors of
the selection classes expect resolved positions now.

The `findDiffStart` and `findDiffEnd` functions were moved to
[methods](http://prosemirror.net/version/0.8.0.html#Fragment.findDiffStart) on `Fragment`.

Some [transformation](http://prosemirror.net/version/0.8.0.html#Transform) methods are now less vague in their
parameters. [`wrap`](http://prosemirror.net/version/0.8.0.html#Transform.wrap) requires the range to wrap and
the entire set of wrappers as argument, [`lift`](http://prosemirror.net/version/0.8.0.html#Transform.lift)
expects a range and target depth.

The [`findWrapping`](http://prosemirror.net/version/0.8.0.html#findWrapping) and [`liftTarget`](http://prosemirror.net/version/0.8.0.html#liftTarget)
functions are used to compute these before trying to apply the
transformation. They replace `canWrap` and `canLift`.

The structure of the [markdown](http://prosemirror.net/version/0.8.0.html#markdown) parser and serializer was
changed to no longer rely on `SchemaItem.register`. Adjusting the
parser and serializer now works differently (you explicitly create an
object rather than relying on information attached to node types).

The `autoinput` module was removed. The [`inputrules`](http://prosemirror.net/version/0.8.0.html#inputrules)
module now exports a plugin that can be used to add input rules, along
with a number of basic input rules and helper functions to create
schema-specific input rules.

The [`menu`](http://prosemirror.net/version/0.8.0.html#menu) module is now a single module, which exports the
menu primitives along with the [`menuBar`](http://prosemirror.net/version/0.8.0.html#menuBar) and
[`tooltipMenu`](http://prosemirror.net/version/0.8.0.html#tooltipMenu) plugins.

Menu construction is no longer entangled with command definitions. The
`MenuCommand` class was replaced with a [`MenuItem`](http://prosemirror.net/version/0.8.0.html#MenuItem)
class, which directly declares the things it would previously get from
a command. The concept of a `MenuGroup` was dropped (we just use
arrays, since they are always static). Some helper functions for
creating menu items, along with some basic icons, are exported from
the `menu` module.

The `ui` module is now a single module, which exports the
[`Tooltip`](http://prosemirror.net/version/0.8.0.html#Tooltip) class and the [prompt](http://prosemirror.net/version/0.8.0.html#FieldPrompt)-related
functionality. Now that command parameters no longer exist, the
interface for creating a prompt was also changed.

The events emitted by the [`collab`](http://prosemirror.net/version/0.8.0.html#collab) module (which now
exports a plugin) are now
[subscriptions](https://github.com/marijnh/subscription#readme) on the
plugin state object, named [`mustSend`](http://prosemirror.net/version/0.8.0.html#Collab.mustSend) and
[`receivedTransform`](http://prosemirror.net/version/0.8.0.html#Collab.receivedTransform).

`Step.register` was renamed to [`Step.jsonID`](http://prosemirror.net/version/0.8.0.html#Step.jsonID).

All non-essential CSS rules were removed from the core.

### Bug fixes

Several issues where the code didn't properly enforce the content
constraints introduced in 0.7.0 were fixed.

When pasting content into an empty textblock, the parent node it was
originally copied from is now restored, when possible.

Several improvements in the handling of composition and input events
(mostly used on mobile platforms). Fixes problem where you'd get a
strange selection after a complex composition event.

Make by-word deletion work properly on astral plane characters.

Fix leaked spacer node when the menu bar was disabled while it was
floating.

### New features

[Plugins](http://prosemirror.net/version/0.8.0.html#Plugin) are objects used to attach (and detach) a specific
piece of functionality to an editor. Modules that extend the editor
now export values of this type. The [`plugins`](http://prosemirror.net/version/0.8.0.html#option_plugins)
option is the easiest way to enable plugins.

The [`contextAtCoords`](http://prosemirror.net/version/0.8.0.html#ProseMirror.contextAtCoords) method provides
more precise information about a given position (including the exact
nodes around the position) than the existing `posAtCoords` method.

The [`EditorTransform`](http://prosemirror.net/version/0.8.0.html#EditorTransform) abstraction is now more
closely integrated with the editor selection, and you can call
[`setSelection`](http://prosemirror.net/version/0.8.0.html#EditorTransform.setSelection) on it to update the
selection during a transform.

The new [`applyAndScroll`](http://prosemirror.net/version/0.8.0.html#EditorTransform.applyAndScroll) method on
editor transforms provides a convenient shortcut for the common case
of applying a transformation and scrolling the selection into view.

The new methods [`addActiveMark`](http://prosemirror.net/version/0.8.0.html#ProseMirror.addActiveMark) and
[`removeActiveMark`](http://prosemirror.net/version/0.8.0.html#ProseMirror.removeActiveMark) provide explicit
control over the active stored marks.

The `edit` module now exports an object `commands` containing a number
of command functions and functions that produce command functions.
Most of the old command objects have an equivalent here.

The [`forEach`](http://prosemirror.net/version/0.8.0.html#Node.forEach) method on nodes and fragments now also
passes the node's index to its callback.

Nodes now have a [`textBetween`](http://prosemirror.net/version/0.8.0.html#Node.textBetween) method that
retrieves the text between two positions.

A new [`NodeRange`](http://prosemirror.net/version/0.8.0.html#NodeRange) abstraction (created with the
[`blockRange`](http://prosemirror.net/version/0.8.0.html#ResolvedPos.blockRange) method on positions) is used
to specify the range that some of the transformation methods act on.

Node types got two new variants of their [`create`](http://prosemirror.net/version/0.8.0.html#NodeType.create)
method: [`createChecked`](http://prosemirror.net/version/0.8.0.html#NodeType.createChecked), which raises an
error if the given content isn't valid (full) content for the node,
and [`createAndFill`](http://prosemirror.net/version/0.8.0.html#NodeType.createAndFill), which will
automatically insert required nodes to make the content valid.

The `fixContent` method on node types was removed.

You can now pass a second argument to the [`Schema`](http://prosemirror.net/version/0.8.0.html#Schema)
constructor, and access its value under the schema object's `data`
property, to store arbitrary user data in a schema.

The transform module now exports an [`insertPoint`](http://prosemirror.net/version/0.8.0.html#insertPoint)
function for finding the position at which a node can be inserted.

The [`OrderedMap`](http://prosemirror.net/version/0.8.0.html#OrderedMap) class received a new method,
[`addBefore`](http://prosemirror.net/version/0.8.0.html#OrderedMap.addBefore).

A new module, [`example-setup`](http://prosemirror.net/version/0.8.0.html#example-setup) provides a plugin
that makes it easy to set up a simple editor with the
[basic schema](http://prosemirror.net/version/0.8.0.html#schema-basic) and the key bindings, menu items, and
input rules that used to be the default.

The [list](http://prosemirror.net/version/0.8.0.html#ListItem) node types in the basic schema now require the
first child of a list item to be a regular paragraph. The list-related
commands are now aware of this restriction.

## 0.7.0 (2016-05-19)

### Breaking changes

The following properties on node types have lost their meaning:
`kind`, `contains`, `canBeEmpty` and `containsMarks`. The `NodeKind`
type is also gone.

The information they used to encode is now put in a
[content expression](http://prosemirror.net/guide/schema.html#content_expressions),
which is part of the [schema spec](http://prosemirror.net/version/0.7.0.html#SchemaSpec), not the node. Such
expressions can refer directly to other nodes in the schema (by name).

[`SchemaSpec`](http://prosemirror.net/version/0.7.0.html#SchemaSpec) is now an interface, not a class. Its
[`nodes`](http://prosemirror.net/version/0.7.0.html#SchemaSpec.nodes) field refers to [`NodeSpec`](http://prosemirror.net/version/0.7.0.html#NodeSpec)
objects, rather than directly to `NodeType` constructors. These hold
not only a constructor but also a content expression and optionally a
group identifier.

The [`NodeType`](http://prosemirror.net/version/0.7.0.html#NodeType) methods `canContain`,
`canContainFragment`, `canContainMark`, `canContainContent`, and
`canContainType` are gone, since they can't accurately express the
constraints of the new content expressions.

Instead, [nodes](http://prosemirror.net/version/0.7.0.html#Node) now expose [`canReplace`](http://prosemirror.net/version/0.7.0.html#Node.canReplace),
[`canReplaceWith`](http://prosemirror.net/version/0.7.0.html#Node.canReplaceWith), and
[`canAppend`](http://prosemirror.net/version/0.7.0.html#Node.canAppend). The
[`contentMatchAt`](http://prosemirror.net/version/0.7.0.html#Node.contentMatchAt) method gets you a
[`ContentMatch`](http://prosemirror.net/version/0.7.0.html#ContentMatch) object which provides further ways to
reason about content.

[`NodeType.findConnection`](http://prosemirror.net/version/0.7.0.html#NodeType.findConnection) is now at
[`ContentMatch.findWrapping`](http://prosemirror.net/version/0.7.0.html#ContentMatch.findWrapping), and takes
and returns attributes as well as node types.

[Mark types](http://prosemirror.net/version/0.7.0.html#MarkType) lost their `rank` property, as their ordering
is now determined by the order in which they appear in the [schema
spec](http://prosemirror.net/version/0.7.0.html#SchemaSpec.marks).

Transform steps are now regular classes,
[`AddMarkStep`](http://prosemirror.net/version/0.7.0.html#AddMarkStep), [`RemoveMarkStep`](http://prosemirror.net/version/0.7.0.html#RemoveMarkStep),
[`ReplaceStep`](http://prosemirror.net/version/0.7.0.html#ReplaceStep), and
[`ReplaceAroundStep`](http://prosemirror.net/version/0.7.0.html#ReplaceAroundStep).
[`Transform.step`](http://prosemirror.net/version/0.7.0.html#Transform.step) now only takes a step object, not
separate values. The `"join"`, `"split"`, and `"ancestor"` step types
have been superseded by `ReplaceStep` and `ReplaceAroundStep`.

The collaborative editing protocol was changed, to resolve a
synchronization
[problem](https://discuss.prosemirror.net/t/how-to-handle-edge-case-with-collab-module/288/1).
See [the guide](http://prosemirror.net/guide/collab.html) for an
overview of the new protocol.

### New features

Node nesting is now expressed through a more powerful mechanism,
[content expressions](http://prosemirror.net/guide/schema.html#content_expressions).

The [`ContentMatch`](http://prosemirror.net/version/0.7.0.html#ContentMatch) class provides a way to apply and
reason about such content expressions.

The new [`OrderedMap`](http://prosemirror.net/version/0.7.0.html#OrderedMap) class makes it possible to extend
and modify the sets of [nodes](http://prosemirror.net/version/0.7.0.html#SchemaSpec.nodes) and
[marks](http://prosemirror.net/version/0.7.0.html#SchemaSpec.marks) in a schema while keeping control over
their order.

Since splitting isn't always possible any more, a new function
[`canSplit`](http://prosemirror.net/version/0.7.0.html#canSplit) is exported by the
[`transform` module](http://prosemirror.net/version/0.7.0.html#transform).

The new options [`scrollTreshold`](http://prosemirror.net/version/0.7.0.html#scrollTreshold) and
[`scrollMargin`](http://prosemirror.net/version/0.7.0.html#scrollMargin) provide more control over scrolling
behavior.

[`nodesBetween`](http://prosemirror.net/version/0.7.0.html#Node.nodesBetween) now passes the node's index to
its callback as fourth argument.

[Node types](http://prosemirror.net/version/0.7.0.html#NodeType) gained a getter [`isLeaf`](http://prosemirror.net/version/0.7.0.html#NodeType.isLeaf)
to conveniently test whether they allow content.

[Resolved positions](http://prosemirror.net/version/0.7.0.html#ResolvedPos) got a new method
[`indexAfter`](http://prosemirror.net/version/0.7.0.html#ResolvedPos.indexAfter), and their methods that
expect a depth allow the argument to be omitted to specify the
position's own depth, or a negative integer to be passed to specify a
depth relative to the position's depth.

## 0.6.1 (2016-04-15)

### Bug fixes

Composition (IME) input is now more robust. This mostly effects
Android browsers, where typing is now less buggy.

The iOS virtual keyboard's default case should now update as you type
(rather than being stuck in whatever state it was in when you started
typing).

Text input read through composition or input events now fires input
rules.

A problem where transform filters could corrupt the undo history has
been fixed.

## [0.6.0](http://prosemirror.net/version/0.6.0.html) (2016-04-13)

### Breaking changes

Positions in the document are now represented by
[integers](http://prosemirror.net/guide/doc.html#indexing), rather
than `Pos` objects. This means that _every_ function parameter, return
value, or property that used to be a `Pos` is now a number instead.

Be _extra_ wary about functions that return an optional position—0 is
a valid position now, so if your code is just checking `if (pos) ...`,
it'll break when getting a 0.

The [`countCoordsAsChild`](http://prosemirror.net/version/0.6.0.html#NodeType.countCoordsAsChild),
[`handleClick`](http://prosemirror.net/version/0.6.0.html#NodeType.handleClick),
[`handleDoubleClick`](http://prosemirror.net/version/0.6.0.html#NodeType.handleDoubleClick), and
[`handleContextMenu`](http://prosemirror.net/version/0.6.0.html#NodeType.handleContextMenu) methods on
[node types](http://prosemirror.net/version/0.6.0.html#NodeType), which used to take a path as an array of
numbers, now get a single number pointing at the node's position in
the document instead.

The `"selectNodeLeft/Right/Up/Down"` commands, which were a hack to make node
selection work, are now no longer exposed as commands.

The key bindings for block types changed again, due to the old ones
still clashing with default OS X bindings. They are now prefixed with
Shift-Ctrl (rather than Shift-Cmd on OS X).

[Nodes](http://prosemirror.net/version/0.6.0.html#Node) lost the `size` and `width` properties, and now expose
a [`nodeSize`](http://prosemirror.net/version/0.6.0.html#Node.nodeSize) property instead, which is the total
size of the node. The [`size`](http://prosemirror.net/version/0.6.0.html#Fragment.size) attribute on
[fragments](http://prosemirror.net/version/0.6.0.html#Fragments) changed meaning to point at the total size of
the fragment's children (rather than their count).

Node iterators are gone, and replaced by index-based access using the
[`childCount`](http://prosemirror.net/version/0.6.0.html#Node.childCount) property and the
[`child`](http://prosemirror.net/version/0.6.0.html#Node.child) and [`maybeChild`](http://prosemirror.net/version/0.6.0.html#Node.maybeChild)
accessors.

The `chunkBefore` and `chunkAfter` methods on nodes are replaced by a
[`childBefore`](http://prosemirror.net/version/0.6.0.html#Node.childBefore) and
[`childAfter`](http://prosemirror.net/version/0.6.0.html#Node.childAfter) method with the same role but
slightly different semantics.

[`Node.slice`](http://prosemirror.net/version/0.6.0.html#Node.slice) now returns a [`Slice`](http://prosemirror.net/version/0.6.0.html#Slice).
[`Node.sliceBetween`](http://prosemirror.net/version/0.6.0.html#Node.sliceBetween) is gone. The method that
just returns a reduced [`Node`](http://prosemirror.net/version/0.6.0.html#Node) is now called [`cut`](http://prosemirror.net/version/0.6.0.html#Node.cut)
(and also present on [fragments](http://prosemirror.net/version/0.6.0.html#Fragment.cut)).

The [node](http://prosemirror.net/version/0.6.0.html#Node) and [fragment](http://prosemirror.net/version/0.6.0.html#Fragment) methods `splice`,
`append`, `close`, `replaceDeep`, and the old `replace` are gone.
Document manipulation is now best done in one shot using the new
[`replace`](http://prosemirror.net/version/0.6.0.html#Node.replace) method, which replaces a range of the
document with a [`Slice`](http://prosemirror.net/version/0.6.0.html#Slice).

Since we are no longer using arrays of numbers to find nodes,
`Node.path` is gone. To find out what an integer position points at,
use [`Node.resolve`](http://prosemirror.net/version/0.6.0.html#Node.resolve), and then inspect the resulting
[`ResolvedPos`](http://prosemirror.net/version/0.6.0.html#ResolvedPos) object.

`Node.nodeAfter` is now called [`Node.nodeAt`](http://prosemirror.net/version/0.6.0.html#Node.nodeAt). It does mostly the same
thing, except that it now takes a number position.

[`Node.nodesBetween`](http://prosemirror.net/version/0.6.0.html#Node.nodesBetween) passes a start position for the current node,
rather than mutable path, to its callback. `Node.inlineNodesBetween`
is gone, since it is now very easy to do something like that with
`nodesBetween`. [`Node.descendants`](http://prosemirror.net/version/0.6.0.html#Node.descendants) is a new shorthand that iterates
over _all_ descendant nodes.

[Fragments](http://prosemirror.net/version/0.6.0.html#Fragment) lost their `toArray`, `map`, and `some`
methods, and otherwise mostly mirror the changes in the [`Node`](http://prosemirror.net/version/0.6.0.html#Node) type.

The constant empty fragment now lives under [`Fragment.empty`](http://prosemirror.net/version/0.6.0.html#Fragment.empty) rather
than `emptyFragment`.

[Steps](http://prosemirror.net/version/0.6.0.html#Step) lost their `pos` property. They now only store a
[`from`](http://prosemirror.net/version/0.6.0.html#Step.from) and [`to`](http://prosemirror.net/version/0.6.0.html#Step.to) (as numbers rather than `Pos` objects).

The [result](http://prosemirror.net/version/0.6.0.html#StepResult) of applying a step no longer contains a
[position map](http://prosemirror.net/version/0.6.0.html#PosMap). Those can be derived from a step without
applying it now (using the [`posMap`](http://prosemirror.net/version/0.6.0.html#Step.posMap) method). A
failing step no longer returns `null`. Rather, a step result contains
_either_ an error message _or_ an updated document.

You no longer need to provide a [position map](http://prosemirror.net/version/0.6.0.html#PosMap) when
[inverting](http://prosemirror.net/version/0.6.0.html#Step.invert) a step.

The [`Mappable`](http://prosemirror.net/version/0.6.0.html#Mappable) interface's [`map`](http://prosemirror.net/version/0.6.0.html#Mappable.map)
method now returns a plain position, instead of a
[`MapResult`](http://prosemirror.net/version/0.6.0.html#MapResult). Use the
[`mapResult`](http://prosemirror.net/version/0.6.0.html#Mappable.mapResult) method if you need the additional
information.

[Position maps](http://prosemirror.net/version/0.6.0.html#PosMap) have gotten much simpler, and are created
differently now.

[Transforms](http://prosemirror.net/version/0.6.0.html#Transform) no longer silently ignore failing steps
unless you explicitly tell them to by using the
[`maybeStep`](http://prosemirror.net/version/0.6.0.html#Transform.maybeStep) method. The
[`step`](http://prosemirror.net/version/0.6.0.html#Transform.step) method, along with most of the other
transformation methods, will raise an error when they can't be
applied.

[`Transform.replace`](http://prosemirror.net/version/0.6.0.html#Transform.replace) now takes a
[`Slice`](http://prosemirror.net/version/0.6.0.html#Slice) object, rather than a full replacement document
with start and end positions.

### Bug fixes

An unsoundness in the collaborative editing algorithm's handling of
replace steps has been fixed.

The SVG icons now also work when you have a `<base>` tag on your page.

Fix select-all on Firefox.

Fix crash in history compression.

Properly handle HTML sublists not wrapped in an `<li>` tag.

Prevent Ctrl-Enter and Ctrl-Backspace on OS X from messing up our
document.

Handle the case where a `clipboardData` object is present but doesn't
actually work (iOS).

### New features

[`ProseMirror.flush`](http://prosemirror.net/version/0.6.0.html#ProseMirror.flush) now return a boolean
indicating whether it redrew the display.

New data type, [`Slice`](http://prosemirror.net/version/0.6.0.html#Slice), which represents a piece of document along
with information about the nodes on both sides that are ‘open’ (can be
joined to adjacent nodes when inserting it into a document).

The new [`"transformPasted"`](http://prosemirror.net/version/0.6.0.html#ProseMirror.event_transformPasted)
event can be used to transform pasted or dragged content, as a parsed
[`Slice`](http://prosemirror.net/version/0.6.0.html#Slice).

The [`Node.eq`](http://prosemirror.net/version/0.6.0.html#Node.eq) predicate can now be used to determine whether two nodes
are equal.

[Mark types](http://prosemirror.net/version/0.6.0.html#MarkType) can
now control whether they are applied to text typed after such a mark
with their
[`inclusiveRight`](http://prosemirror.net/version/0.6.0.html#MarkType.inclusiveRight)
property.

The [`join`](http://prosemirror.net/version/0.6.0.html#Transform.join) and [`lift`](http://prosemirror.net/version/0.6.0.html#Transform.lift)
transform methods now have a `silent` parameter to suppress exceptions
when they can not be applied.

The `type` parameter to [`setNodeType`](http://prosemirror.net/version/0.6.0.html#Transform.setNodeType) now
defaults to the node's current type.

[`toDOM`](http://prosemirror.net/version/0.6.0.html#toDOM), [`toHTML`](http://prosemirror.net/version/0.6.0.html#toHTML), and [`toText`](http://prosemirror.net/version/0.6.0.html#toText) now
accept [`Fragment`](http://prosemirror.net/version/0.6.0.html#Fragment) objects as well as nodes.

List items now have [`lift`](http://prosemirror.net/version/0.6.0.html#list_item:lift) and
[`sink`](http://prosemirror.net/version/0.6.0.html#list_item:sink) commands.

## 0.5.1 (2016-03-23)

### Bug fixes

Fix malformed call that caused any nodes rendered with
`contenteditable=false` to be replaced by a bogus `<div>`.

## [0.5.0](http://prosemirror.net/version/0.5.0.html) (2016-03-22)

### Bug fixes

ProseMirror now ignores most evens when not focused, so you can have
focusable fields inside the editor.

The Markdown serializer is now a lot more clever about serializing
mixed inline styles.

Event handlers unregistering themselves is now safe (used to skip next
event handler).

### New features

The default command parameter prompt UI now shows the command label
and a submit button.

When joining an empty textblock with a non-empty one, the resulting
block now gets the type of the non-empty one.

Node types can now handle double clicks with a `handleDoubleClick`
method.

Undo and redo now restore the selection that was current when the
history event was created.

The collab module now fires a `"collabTransform"` event when receiving
changes.

The `"filterTransform"` event can now be used to cancel transforms.

Node kinds can now specify both their super- and sub-kinds.

## [0.4.0](http://prosemirror.net/version/0.4.0.html) (2016-02-24)

### Breaking changes

The way valid parent-child relations for [node types](http://prosemirror.net/version/0.4.0.html#NodeType) are
specified was changed. Instead of relying on strings, node
[kinds](http://prosemirror.net/version/0.4.0.html#NodeKind) are now objects that specify arbitrary sub-kind
relations. The static `kinds` property on node types replaced by a
non-static `kind` property holding such a kind object, and the
`contains` property is now expected to hold a kind object instead of a
string.

The keybindings for make-paragraph and make-heading were changed. To
make the current textblock a paragraph, you now press Ctrl/Cmd-0, and
to make it a heading, you press Ctrl/Cmd-N, where N is the level of
the heading.

### Bug fixes

Copy-pasting between ProseMirror instances is now more robust (the
question of whether the selection cuts through nodes at the start and
end of the fragment is preserved).

Selection management on mobile platforms should now be improved (no
longer unusable, probably still quite buggy).

Fix a problem where reading a change from the DOM was confused by
trailing whitespace in a text block.

Fix a bug in scrolling things into view that would break scrolling of
anything except the whole document.

Don't render menu dropdown elements unless they actuall have content.

Fix bug that would reset the selection when a
[`selectionChange` event](http://prosemirror.net/version/0.4.0.html#ProseMirror.event_selectionChange) handler
tried to access it.

The [selection](http://prosemirror.net/version/0.3.0.html#Selection) classes are now properly exported from
the `edit` module.

### New features

Drop events can now be [intercepted](http://prosemirror.net/version/0.4.0.html#ProseMirror.event_drop).

The [`beforeTransform`](http://prosemirror.net/version/0.4.0.html#ProseMirror.event_beforeTransform) event is
now fired before a transform is [applied](http://prosemirror.net/version/0.4.0.html#ProseMirror.apply).

Menu command icon [specs](http://prosemirror.net/version/0.4.0.html#MenuCommandSpec.display) can now provide a
`dom` property to provide a piece of DOM structure as their icon.

[DOM parser specs](http://prosemirror.net/version/0.4.0.html#DOMParseSpec) can now include a `selector`
property to only run the parser on nodes that match the selector.

## [0.3.0](http://prosemirror.net/version/0.3.0.html) (2016-02-04)

### Breaking changes

The way menu items for menu modules are configured now works
differently, expecting types from the [`menu`](http://prosemirror.net/version/0.3.0.html#menu/menu) module.
The way commands declare themselves to be part of a menu group is also
different—the information previously stored in the `menuGroup` and
`display` properties now goes, in a somewhat different format, in the
[`menu`](http://prosemirror.net/version/0.3.0.html#CommandSpec.menu) property.

The command parameter prompting functionality was changed. The
`paramHandler` option has been replaced by a
[`commandParamPrompt`](http://prosemirror.net/version/0.3.0.html#commandParamPrompt) option. The prompting
functionality now lives in the [`prompt`](http://prosemirror.net/version/0.3.0.html#ui/prompt) module, and
should be easier to extend.

The styling and animation of menus and tooltips was changed to be
simpler and easier to maintain. Fancy UI looks are now considered out
of scope for this module, and something that should be implemented in
third-party modules.

### Bug fixes

Selection on mobile should work much better now (though probably still
far from perfect).

Pressing enter on a mobile device will no longer corrupt
the display.

### New features

New menu building blocks in the [`menu`](http://prosemirror.net/version/0.3.0.html#menu/menu) module allow
more control and flexibility when defining menus.

[`ProseMirror.history`](http://prosemirror.net/version/0.3.0.html#History) is now documented and received a
new [`isAtVersion`](http://prosemirror.net/version/0.3.0.html#History.isAtVersion) method to check whether an
editor is 'clean' relative to a given version.

## [0.2.0](http://prosemirror.net/version/0.2.0.html) (2016-01-28)

### Breaking changes

 * The
   [`register`](http://prosemirror.net/version/0.2.0.html#SchemaItem.register)
   method's signature changed, requiring an item name as well as a
   namespace. Most uses of the schema registry now use that name to
   replace a field that was previously part of the registered value.
   For example, command specs no longer have a `name` field, but use
   the registry name. (This was needed to make it possible to
   selectively override or disable registered values in classes that
   derive from schema items.)

 * [`InputRule`s](http://prosemirror.net/version/0.2.0.html#InputRules) no
   longer have a `name` field, and the corresponding constructor
   parameter was removed.
   [`removeInputRule`](http://prosemirror.net/version/0.2.0.html#removeInputRule)
   now takes a rule object rather than a name string.

 * Items in the 'insert' and node type menus are now added with
   [`register`](http://prosemirror.net/version/0.2.0.html#SchemaItem.register)
   (under `"insertMenu"` and `"textblockMenu"`) rather then with a
   direct property.

 * The JSON representation of
   [marks](http://prosemirror.net/version/0.2.0.html#Marks) changed. This
   release will still parse the old representation (spitting out a
   warning). The next release won't, so if you're storing JSON data
   make sure you parse and re-save at least once with 0.2.0 before
   upgrading further.

 * The function passed to the
   [`UpdateScheduler`](http://prosemirror.net/version/0.2.0.html#UpdateScheduler)
   constructor now starts in the DOM write phase (used to be read).

 * The `"flushed"` event was removed.

 * The `selectedDoc` and `selectedText` methods were removed.

### Bug fixes

 * The Markdown parser now throws an error when encountering a token
   it doesn't know how to handle.

 * The menubar will no longer hide the top of the content when the
   controls inside of it line-wrap.

 * Dropped content is now properly selected.

 * Less fragile rules for curly quote autocompletion.

 * The DOM parser now ignore non-displaying tags (like `<script>` and
   `<style>`).

 * Our `package.json` now has a `"main"` field.

 * Fix bug where trailing newlines in code blocks would not be
   visible.

 * Fix several issues with locating positions in the DOM that occurred
   for node types that wrapped their content in more than a single
   element (such as the default code blocks).

### New features

 * The [menu/menu](http://prosemirror.net/version/0.2.0.html#menu/menu) module
   now exposes an object
   [`paramTypes`](http://prosemirror.net/version/0.2.0.html#paramTypes) which
   allows you to add or redefine the types of parameters that can be
   rendered.

 * The [ui/update](http://prosemirror.net/version/0.2.0.html#ui/update) module
   now exports `scheduleDOMUpdate` and `unscheduleDOMUpdate` functions
   to schedule synchronized DOM updates.

 * Schema items now expose a
   [`cleanNamespace`](http://prosemirror.net/version/0.2.0.html#SchemaItem.cleanNamespace)
   method to 'forget' values registered on superclasses.

 * The computation of registered values on schema items can now be
   delayed to schema-instantiation-time with the
   [`registerComputed`](http://prosemirror.net/version/0.2.0.html#SchemaItem.registerComputed)
   method.

 * Schema items can now register
   [`"configureMarkdown"`](http://prosemirror.net/version/0.2.0.html#ParseMarkdownSpec)
   items to influence the way the parser library is initialized.

 * The
   [`"splitBlock"`](http://prosemirror.net/version/0.2.0.html#baseCommands.splitBlock)
   command will now split off a plain paragraph when executed at the
   start of a different kind of textblock.

 * [Node types](http://prosemirror.net/version/0.2.0.html#NodeType) may now
   define a
   [`handleContextMenu`](http://prosemirror.net/version/0.2.0.html#NodeType.handleContextMenu)
   method to intercept context menu events inside of them.

 * The [`Heading`](http://prosemirror.net/version/0.2.0.html#Heading) node type
   now supports a
   [`maxLevel`](http://prosemirror.net/version/0.2.0.html#Heading.maxLevel)
   property that subclasses can use to configure the maximum heading
   level.

 * [Node types](http://prosemirror.net/version/0.2.0.html#NodeType) can now
   declare themselves to be
   [`draggable`](http://prosemirror.net/version/0.2.0.html#NodeType.draggable).

 * Node selections can now be dragged.

## 0.1.1 (2016-01-11)

Initial release.

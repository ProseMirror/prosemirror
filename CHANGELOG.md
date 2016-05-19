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

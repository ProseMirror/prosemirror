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

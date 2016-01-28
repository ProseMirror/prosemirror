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

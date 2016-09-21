# prosemirror-prebuilt

[ [**WEBSITE**](http://prosemirror.net) | [**ISSUES**](https://github.com/prosemirror/prosemirror/issues) | [**FORUM**](https://discuss.prosemirror.net) | [![Join the chat at https://gitter.im/ProseMirror/prosemirror](https://badges.gitter.im/ProseMirror/prosemirror.svg)](https://gitter.im/ProseMirror/prosemirror?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) ]

ProseMirror is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and custom
document schemas.

This package includes a pre-built, dependencies-included single file
that includes the core ProseMirror modules. It is mostly intended to
provide an easy way to play around with ProseMirror without setting up
a build system or bundler. You definitely don't want to use it in
production.

The bundle contains these modules:

 * [model](http://prosemirror.net/ref.html#model)
 * [transform](http://prosemirror.net/ref.html#transform)
 * [state](http://prosemirror.net/ref.html#state)
 * [view](http://prosemirror.net/ref.html#view)
 * [keymap](http://prosemirror.net/ref.html#keymap)
 * [history](http://prosemirror.net/ref.html#history)
 * [collab](http://prosemirror.net/ref.html#collab)
 * [inputrules](http://prosemirror.net/ref.html#inputrules)
 * [schemaBasic](http://prosemirror.net/ref.html#schema-basic)
 * [schemaList](http://prosemirror.net/ref.html#schema-list)
 * [schemaTable](http://prosemirror.net/ref.html#schema-table)
 * [menu](https://github.com/prosemirror/prosemirror-menu#readme)
 * [exampleSetup](https://github.com/prosemirror/prosemirror-example-setup#readme)

Each is exported as an object wrapping the module's exported API.

The [project page](http://prosemirror.net) has more information, a
number of [demos](http://prosemirror.net/#demos) and the
[documentation](http://prosemirror.net/docs.html).

This code is released under an
[MIT license](https://github.com/prosemirror/prosemirror/tree/master/LICENSE).
There's a [forum](http://discuss.prosemirror.net) for general
discussion and support requests, and the
[Github bug tracker](https://github.com/prosemirror/prosemirror/issues)
is the place to report issues.

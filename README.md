# prosemirror

[ [**WEBSITE**](http://prosemirror.net) | [**ISSUES**](https://github.com/prosemirror/prosemirror/issues) | [**FORUM**](https://discuss.prosemirror.net) | [**GITTER**](https://gitter.im/ProseMirror/prosemirror) ]

ProseMirror is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and custom
document schemas.

The ProseMirror library consists of a number of separate
[modules](https://github.com/prosemirror/). This repository just
serves as a central issue tracker, and holds a script to help easily
check out all the core modules for development.

The [project page](http://prosemirror.net) has more information, a
number of [examples](http://prosemirror.net/examples/) and the
[documentation](http://prosemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/prosemirror/prosemirror/tree/master/LICENSE).
There's a [forum](http://discuss.prosemirror.net) for general
discussion and support requests, and the
[Github bug tracker](https://github.com/prosemirror/prosemirror/issues)
is the place to report issues.

**STOP READING HERE IF YOU'RE SIMPLY _USING_ PROSEMIRROR. YOU CAN
INSTALL THE SEPARATE [NPM
MODULES](https://www.npmjs.com/search?q=prosemirror-) FOR THAT. THE
INSTRUCTIONS BELOW ONLY APPLY WHEN _DEVELOPING_ PROSEMIRROR!**

## Setting up a dev environment

Clone this repository, and make sure you have
[node](https://nodejs.org/en/) and [yarn](https://yarnpkg.com/) (due
to a string of issues with NPM 5, NPM is not currently supported)
installed. Next, from the cloned directory run:

    bin/pm install

This will fetch the submodules, install their dependencies, and build
them.

The `bin/pm` script in this repository provides functionality for
working with the repositories:

 * `bin/pm build` rebuilds all the modules

 * `bin/pm watch` sets up a process that automatically rebuilds the
   modules when they change

 * `bin/pm status` prints the git status of all submodules

 * `bin/pm commit <args>` runs `git commit` with the given arguments
   in all submodules that have pending changes

 * `bin/pm test` runs the (non-browser) tests in all modules

 * `bin/pm push` runs `git push` in all modules.

 * `bin/pm grep <pattern>` greps through the source code for the
   modules for the given pattern

(Functionality for managing releases will be added in the future.)

## Running the demo

To run the demo in `demo/`, do `npm run demo`, and go to
[localhost:8080](http://localhost:8080/). This loads the individual
JavaScript files from the distribution's `dist` directories, and will
only need a refresh when those are changed.

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

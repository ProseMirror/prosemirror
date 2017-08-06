# prosemirror

[ [**WEBSITE**](http://prosemirror.net) | [**ISSUES**](https://github.com/prosemirror/prosemirror/issues) | [**FORUM**](https://discuss.prosemirror.net) | [**GITTER**](https://gitter.im/ProseMirror/prosemirror) ]

ProseMirror is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and custom
document schemas.

The library consists of a number of
[modules](https://github.com/prosemirror/). This repository just
serves as a central issue tracker, and holds a script to help easily
check out all the core modules for development.

The [project page](http://prosemirror.net) has more information, a
number of [demos](http://prosemirror.net/#demos) and the
[documentation](http://prosemirror.net/docs.html).

**NOTE:** This project is in *BETA* stage. It isn't thoroughly tested,
and the API might still change across `0.x` releases. You are welcome
to use it, but don't expect it to be very stable yet.

This code is released under an
[MIT license](https://github.com/prosemirror/prosemirror/tree/master/LICENSE).
There's a [forum](http://discuss.prosemirror.net) for general
discussion and support requests, and the
[Github bug tracker](https://github.com/prosemirror/prosemirror/issues)
is the place to report issues.

## Setting up a dev environment

If you clone this repository and `yarn install` it (due to a string of
issues with NPM 5, NPM is not currently supported), the installation
script will create subdirectories for all the core prosemirror modules
(as well as some not-really-core modules needed to run demos), such as
`model`, `view`, `state`, etc, symlink the internal dependencies
between those, and then `npm install` their remaining dependencies.

The `bin/pm` script in this repository provides functionality for
working with the repositories:

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

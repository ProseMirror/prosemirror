# ProseMirror

This is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and
customizable document models.

The [project page](http://prosemirror.net) has a number of
[demos](http://prosemirror.net/#demos) and the
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

Documentation can be found on [the
website](http://prosemirror.net/doc/manual.html).

## Run the demo

Install [Node.js](http://nodejs.org).

Inside the project directory, install the project's node dependencies

```bash
npm install
```

Make sure you have an up-to-date `dist/` dir:

```bash
npm run dist
# or, to keep compiling as files are changed
npm run dist-watch
# or, to mount a virtual ES6-compiling filesystem
# (might not work on non-Linux OSs)
npm run distfs
```

Start the demo server (serves demo files, resolves modules):

```bash
npm run demo
```

Open `http://localhost:8080/` in your browser

# ProseMirror

This is a well-behaved what-you-see-is-what-you-mean editor based on
contentEditable, with support for collaborative editing and (soon)
customizable document models.

The project page, which has a number of demos, is
[prosemirror.net](http://prosemirror.net). project.

**NOTE:** This project is in *BETA* stage. It isn't well-tested yet,
there are no NPM modules yet, and the APIs may change at will for the
time being. You are welcome to use it, but you can't expect it to be
stable or mature yet.

This code is released under an [MIT-style
license](https://github.com/prosemirror/prosemirror/tree/master/LICENSE).
There's a [forum](http://discuss.prosemirror.net) for general
discussion and support requests, and the [Github bug
tracker](https://github.com/prosemirror/prosemirror/issues) is the
place to report issues.

Documentation can be found on [the
website](http://prosemirror.net/doc/manual.html).

## Structure

This software is written as a collection of ES6 modules. Since JS
engines don't really run ES6 yet, it has to be compiled to ES5 to
actually run. You can use `npm run dist` to compile a copy of the
source tree under the `dist` directory. You would then typically use
[Browserify](http://browserify.org/),
[Webpack](https://webpack.github.io/), or something similar to package
up the modules you need for the browser.

Here's a rough overview of the source directories:

```
src/
  model/      The document model
  transform/  Operations on the document model
  edit/       The editor
  collab/     Collaborative editing module
  inputrules/ Magic input (-- → —) module
  convert/    Document conversion code to and from DOM, HTML, and Markdown
  menu/       Menu UI modules
```

Most of these contain an `index.js` file that exposes the module's
content as a flat object (i.e. no attempts are made to make the 'main'
thing in a module the exported value or default export).

## Run the demo

Install [Node.js](http://nodejs.org).

Inside the project directory, install the project's node dependencies

```bash
npm install
```

Build the demo, which will recompile files on change

```bash
npm run demo
```

Open `demo/index.html` in your browser

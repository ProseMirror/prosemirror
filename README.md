# ProseMirror

This is a well-behaved what-you-see-is-what-you-mean editor based on
contentEditable, with support for collaborative editing and (soon)
customizable document models.

THIS CODE IS NOT CURRENTLY OPEN SOURCE (i.e. don't use it yet)

BUT WITH YOUR HELP, IT WILL BE: Take a look at my crowd-funding
campaign at
[IndieGogo](https://www.indiegogo.com/projects/prosemirror/).

There isn't much documentation yet. You can read a bit more about the
project, and see demos at [the project page](http://prosemirror.net).

Here's a rough overview of the source directories (which may go out of
date):

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

To try the editor, run

```
npm install
npm run demo
```

And point your browser at /checkout/dir/demo/index.html

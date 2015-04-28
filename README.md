# ProseMirror

This is to be a well-behaved what-you-see-is-what-you-mean editor
based on contentEditable, with support for collaborative editing and
customizable document models.

THIS CODE IS NOT CURRENTLY OPEN SOURCE (i.e. don't use it)

There isn't much documentation yet, because everything is being
rewritten twice per week. Here's a rough overview of the source
directories (which may go out of date):

```
src/
  model/      The document model
  transform/  Operations on the document model
  edit/       The editor
  collab/     Collaborative editing module
  inputrules/ Magic input (-- → —) module
  markdown/   Converting the document model from and to Markdown
  menu/       Menu UI modules
```

To try the editor, run

```
npm install
npm run demo
```

And point your browser at /checkout/dir/demo/index.html

# How to contribute

- [Getting help](#getting-help)
- [Submitting bug reports](#submitting-bug-reports)
- [Contributing code](#contributing-code)

## Getting help

Community discussion, questions, and informal bug reporting is done on the
[discuss.ProseMirror forum](http://discuss.prosemirror.net).

## Submitting bug reports

Report bugs on the
[GitHub issue tracker](http://github.com/prosemirror/prosemirror/issues).
Before reporting a bug, read these pointers.

- The issue tracker is for *bugs*, not requests for help. Questions
  should be asked on the [forum](http://discuss.prosemirror.net).

- Include information about **the browser or platform in which the
  problem occurred**. Even if you tested several platforms, and the
  problem occurred in all of them, mention this fact in the bug
  report. Also include browser version numbers.

- Mention which release of ProseMirror you're using. Preferably, try
  also with the current development snapshot, to ensure the problem
  has not already been fixed.

- Mention very precisely what went wrong. "X is broken" is not a good bug
  report. What did you expect to happen? What happened instead? Describe the
  exact steps a maintainer has to take to make the problem occur. We can not
  fix something that we can not observe.

- A great way to make it easy to reproduce your problem, if it can not
  be trivially reproduced on the website demos, is to submit a script
  or HTML file that triggers the issue.

## Contributing code

- Make sure you have a [GitHub Account](https://github.com/signup/free)

- Fork [the repository](https://github.com/prosemirror/prosemirror/)
  ([how to fork a repo](https://help.github.com/articles/fork-a-repo))
  
- Make your changes, and commit them

- If your changes are easy to test or likely to regress, add tests in
  the `test/` directory. Either put them in an existing `test-*.js`
  file, if they fit there, or add a new file.

- Follow the code style of the rest of the project (see below). Run
  `npm run lint` to verify that the linter is happy (you'll need to
  run `npm install` first).

- Make sure all tests pass.

- Submit a pull request ([how to create a pull request](https://help.github.com/articles/fork-a-repo)).
  Don't put more than one feature/fix in a single pull request.

By contributing code to ProseMirror you

 - Agree to license the contributed code under the project's [MIT
   license](https://github.com/ProseMirror/prosemirror/blob/master/LICENSE).

 - Confirm that you have the right to contribute and license the code
   in question. (Either you hold all rights on the code, or the rights
   holder has explicitly granted the right to use it like this,
   through a compatible open source license or through a direct
   agreement with you.)

### Coding standards

- ES6 syntax, targeting an ES5 runtime (i.e. don't use library
  elements added by ES6, don't use ES7/ES.next syntax).

- 2 spaces per indentation level, no tabs.

- No semicolons except when necessary.

- Follow the surrounding code when it comes to spacing, brace
  placement, etc.

- Brace-less single-statement bodies are encouraged (whenever they
  don't impact readability).

- [getdocs](https://github.com/marijnh/getdocs)-style doc comments
  above items that are part of the public API.

- When documenting non-public items, you can put the type after a
  single colon, so that getdocs doesn't pick it up and add it to the
  API reference.

- The linter (`npm run lint`) complains about unused variables and
  functions. Prefix their names with an underscore to muffle it.

- ProseMirror does *not* follow JSHint or JSLint prescribed style.
  Patches that try to 'fix' code to pass one of these linters will not
  be accepted.

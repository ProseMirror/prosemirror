# ProseMirror post-crowdfunding development plan

Last updated 2015-09-03

This document outlines the development plans and gives a rough
estimate of the order and timeframe in which they will be realized.


## Work

### Build a document schema API

Goal: Design a vocabulary and programming interface for defining
document models.

Considerations:

 - We want to be able, as much as possible, to define node types and
   node attributes atomically, and combine them into schemas.

 - Currently node types specify their kind and the kind of nodes they
   may contain. We may need a more expressive vocabulary for some use
   cases.

   - Support either subtyping of node kinds or sets of contained node
     kinds (so that you can express, for example, that all block
     elements may occur at the top level, but only paragraphs may
     occur inside a list)

   - Allow predicates that express more complicated constraints about
     parent-child relationships, such as that a section node must
     start with a heading, whose level must correspond to the nesting
     depth of the section, etc.

 - Document-manipulating code must be aware of the schema (we'll
   either pass it around or attach it to document nodes), and be
   defined in such a way that it is schema-agnostic.

 - Each node type and attribute specifies at least serialization and
   deserialization strategy to and from DOM nodes. Can optionally
   specify strategies for other formats. A document under a given
   schema can only be (de)serialized to/from format that all its nodes
   and attributes support.

 - Interface functionality, such as menu items, key bindings, and
   command extensions (say, customizing the behavior of the enter key
   in a list) can be attached to node types and attributes so that it
   becomes available when they are selected.

### Actual document schemas

To find out whether the document schema API works, we'll need to write
a lot of schemas. Here are some of the things that people have asked
for:

 - Tables. This is probably one of the more demanding use cases, both
   in working around contentEditable magic and in schema
   expressiveness. Will need a number of menu items, and to express
   constraints like actually being rectangular. There are a lot of
   different aspects about tables (column widths, rowspan/colspan,
   header cells), so this will probably be split into multiple
   elements with composable functionality.

 - Different image flavors. Block-level images, resizeable images,
   being able to plug in an image source (for upload/selection).

 - A number of commonly expected inline styles like font
   family/size/color, strikethrough, underline. I want to focus on
   semantic information as much as possible, but some users insist on
   being able to select fonts etc.

 - Section nodes (as opposed to implicit sections starting at
   headings).

 - Indentation for blocks.

 - The metadata needed to serialize a Markdown document down to
   something close to the original text (the specific syntax and
   indentation used for each construct).

### Documentation

The API is still largely in flux, so I want to start with a rough,
minimal overview in the readme. Once things start looking stable, I
will expand this into a proper manual and comprehensive API
documentation.

We'll also need lots of demos and examples. The ones on the current
project page are a good start for that.

### In-line marker widgets

There is already the markRange method to add style or metadata to a
range of text (outside of the document). I want to add a feature to
show a non-editable widget at a given position. This is useful for
displaying other users' cursors in collaborative editors, or to show
deleted text when tracking changes.

### More efficient marker tracking

Currently, many operations' complexity is linear to the amount of
markers you have in a document. The constant factors are small, so
this'll only cause issues when you have a seriously large amount of
them, but there are use cases that require a lot of markers, so I am
not happy with this.

The plan is to define a hierarchical data structure, so that changing
and rendering the document can mostly ignore markers that are in
unaffected nodes. This is somewhat tricky, since markers can cover
arbitrary ranges and thus the tree structure can't just partition the
space straightforwardly, but not too hard. The position mapping will
have to be extended to work with such a data structure.

### Selection of whole elements

Things that don't have a meaningful cursor position inside them, such
as images or horizontal rules, are currently simply skipped by the
cursor. This mostly makes sense, but in some cases it would be useful
to select them (and only them) with the keyboard in order to
manipulate them. For example, we could activate key bindings and menu
items related to changing the properties of an image when it is
selected.

The idea would be to have two kinds of selections -- classical ranges
(or cursors) as character offsets, and entity selections pointing to a
given node. As you press, for example, left arrow through a paragraph
with a selectable entity, your cursor doesn't go through it but rather
you select it, and the next left-arrow press moves beyond. Clicking
such an entity could also select it.

This requires more intervention from ProseMirror when it comes to
cursor motion, and a system for highlighting such entity selections.


## Roadmap

Here's the order in which I plan to tackle these, along with a rough
timeframe:

 - First documentation draft (early September)

 - Research existing work on document schemas, prototype (mid-late September)

 - Implementation of schema API (late September-mid October)

 - Try to build proofs of concept for the various document-schema use
   cases on top of the schema API (mid-late October)

 - Add UI stuff (menu items, key bindings, mouse interactions) needed
   to make these document extensions usable (early November)

 - Tackle tables and their UI requirements (mid November-...)

 - Stablize APIs, write real documentation (~ December)

And that's about as far as I'm willing to look ahead. This doesn't
cover all the work described above, but it does get us to a point
where the editor can be used in production. There will no doubt be a
lot of issues found with this infant codebase in these months, and
bugfixing work will be happening alongside these plans.

The remaining ideas, along with all the new ideas we'll probably come
up with in the meantime, will have to wait until later (probably next
year).

Please remember that this schedule is a plan, not a promise.

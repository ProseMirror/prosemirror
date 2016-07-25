const {doc, blockquote, h1, h2, p, hr, li, ol, ul, pre, em, strong, code, a, br, img, dataImage} = require("./build")
const {cmpNode, cmpStr} = require("./cmp")
const {defTest} = require("./tests")

const {defaultMarkdownParser, defaultMarkdownSerializer} = require("../markdown")

function t(name, text, doc) {
  defTest("parse_" + name, () => {
    cmpNode(defaultMarkdownParser.parse(text), doc)
    cmpStr(defaultMarkdownSerializer.serialize(doc), text)
  })
}

t("paragraph",
  "hello!",
  doc(p("hello!")))

t("heading",
  "# one\n\n## two\n\nthree",
  doc(h1("one"), h2("two"), p("three")))

t("quote",
  "> once\n\n> > twice",
  doc(blockquote(p("once")), blockquote(blockquote(p("twice")))))

// FIXME bring back testing for preserving bullets and tight attrs
// when supported again

t("bullet_list",
  "* foo\n\n  * bar\n\n  * baz\n\n* quux",
  doc(ul(li(p("foo"), ul(li(p("bar")), li(p("baz")))), li(p("quux")))))

t("ordered_list",
  "1. Hello\n\n2. Goodbye\n\n3. Nest\n\n   1. Hey\n\n   2. Aye",
  doc(ol(li(p("Hello")), li(p("Goodbye")), li(p("Nest"), ol(li(p("Hey")), li(p("Aye")))))))

t("code_block",
  "Some code:\n\n    Here it is\n\nPara",
  doc(p("Some code:"), pre("Here it is"), p("Para")))

t("inline",
  "Hello. Some *em* text, some **strong** text, and some `code`",
  doc(p("Hello. Some ", em("em"), " text, some ", strong("strong"), " text, and some ", code("code"))))

t("inline_overlap_mix",
  "This is **strong *emphasized text with `code` in* it**",
  doc(p("This is ", strong("strong ", em("emphasized text with ", code("code"), " in"), " it"))))

t("inline_overlap_link",
  "**[link](http://foo) is bold**",
  doc(p(strong(a("link"), " is bold"))))

t("inline_overlap_code",
  "**`code` is bold**",
  doc(p(strong(code("code"), " is bold"))))

t("link",
  "My [link](http://foo) goes to foo",
  doc(p("My ", a("link"), " goes to foo")))

t("image",
  "Here's an image: ![x](" + dataImage + ")",
  doc(p("Here's an image: ", img)))

t("break",
  "line one\\\nline two",
  doc(p("line one", br, "line two")))

t("horizontal_rule",
  "one two\n\n---\n\nthree",
  doc(p("one two"), hr, p("three")))

t("ignore_html",
  "Foo < img> bar",
  doc(p("Foo < img> bar")))

t("not_a_list",
  "1\\. foo",
  doc(p("1. foo")))

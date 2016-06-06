const {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, img, hr} = require("./build")
const {Failure} = require("./failure")
const {cmpNode, cmp, cmpStr} = require("./cmp")
const {defTest} = require("./tests")

const {defaultSchema: schema} = require("../schema")
const {toDOM, fromDOM, fromDOMInContext} = require("../htmlformat")

let document = typeof window == "undefined" ? require("jsdom").jsdom() : window.document

function t(name, doc, dom) {
  defTest("dom_" + name, () => {
    let derivedDOM = document.createElement("div")
    derivedDOM.appendChild(toDOM(doc, {document}))
    let declaredDOM = document.createElement("div")
    declaredDOM.innerHTML = dom

    var derivedText = derivedDOM.innerHTML
    var declaredText = declaredDOM.innerHTML
    if (derivedText != declaredText)
      throw new Failure("DOM text mismatch: " + derivedText + " vs " + declaredText)

    cmpNode(fromDOM(schema, derivedDOM), doc)
  })
}

t("simple",
  doc(p("hello")),
  "<p>hello</p>")

t("br",
  doc(p("hi", br, "there")),
  "<p>hi<br/>there</p>")

t("img",
  doc(p("hi", img, "there")),
  '<p>hi<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="x"/>there</p>')

t("join_styles",
  doc(p("one", strong("two", em("three")), em("four"), "five")),
  "<p>one<strong>two</strong><em><strong>three</strong>four</em>five</p>")

t("links",
  doc(p("a ", a("big ", a2("nested"), " link"))),
  "<p>a <a href=\"http://foo\">big </a><a href=\"http://bar\">nested</a><a href=\"http://foo\"> link</a></p>")

t("unordered_list",
  doc(ul(li(p("one")), li(p("two")), li(p("three", strong("!")))), p("after")),
  "<ul><li><p>one</p></li><li><p>two</p></li><li><p>three<strong>!</strong></p></li></ul><p>after</p>")

t("ordered_list",
  doc(ol(li(p("one")), li(p("two")), li(p("three", strong("!")))), p("after")),
  "<ol><li><p>one</p></li><li><p>two</p></li><li><p>three<strong>!</strong></p></li></ol><p>after</p>")

t("blockquote",
  doc(blockquote(p("hello"), p("bye"))),
  "<blockquote><p>hello</p><p>bye</p></blockquote>")

t("nested_blockquote",
  doc(blockquote(blockquote(blockquote(p("he said"))), p("i said"))),
  "<blockquote><blockquote><blockquote><p>he said</p></blockquote></blockquote><p>i said</p></blockquote>")

t("headings",
  doc(h1("one"), h2("two"), p("text")),
  "<h1>one</h1><h2>two</h2><p>text</p>")

t("inline_code",
  doc(p("text and ", code("code that is ", em("emphasized"), "..."))),
  "<p>text and <code>code that is </code><em><code>emphasized</code></em><code>...</code></p>")

t("code_block",
  doc(blockquote(pre("some code")), p("and")),
  "<blockquote><pre><code>some code</code></pre></blockquote><p>and</p>")

function recover(name, html, doc) {
  defTest("dom_recover_" + name, () => {
    let dom = document.createElement("div")
    dom.innerHTML = html
    cmpNode(fromDOM(schema, dom), doc)
  })
}

recover("list",
        "<ol class=\"tight\"><p>Oh no</p></ol>",
        doc(ol(li(p("Oh no")))))

recover("divs_as_paragraphs",
        "<div>hi</div><div>bye</div>",
        doc(p("hi"), p("bye")))

recover("i_and_b",
        "<p><i>hello <b>there</b></i></p>",
        doc(p(em("hello ", strong("there")))))

recover("wrap_paragraph",
        "hi",
        doc(p("hi")))

recover("extra_div",
        "<div><p>one</p><p>two</p></div>",
        doc(p("one"), p("two")))

recover("ignore_whitespace",
        " <blockquote> <p>woo  \n  <em> hooo</em></p> </blockquote> ",
        doc(blockquote(p("woo", em(" hooo")))))

recover("find_place",
        "<ul class=\"tight\"><li>hi</li><p>whoah</p><li>again</li></ul>",
        doc(ul(li(p("hi")), li(p("whoah")), li(p("again")))))

recover("move_up",
        "<div>hello<hr/>bye</div>",
        doc(p("hello"), hr, p("bye")))

recover("dont_ignore_whitespace",
        "<p><em>one</em> <strong>two</strong></p>",
        doc(p(em("one"), " ", strong("two"))))

recover("stray_tab",
        "<p> <b>&#09;</b></p>",
        doc(p()))

recover("random_spaces",
        "<p><b>1 </b>  </p>",
        doc(p(strong("1"))))

recover("empty_code_block",
        "<pre></pre>",
        doc(pre()))

recover("trailing_code",
        "<pre>foo\n</pre>",
        doc(pre("foo\n")))

recover("script",
        "<p>hello<script>alert('x')</script>!</p>",
        doc(p("hello!")))

recover("head_body",
        "<head><title>T</title><meta charset='utf8'/></head><body>hi</body>",
        doc(p("hi")))

recover("double_strong",
        "<p>A <strong>big <strong>strong</strong> monster</strong>.</p>",
        doc(p("A ", strong("big strong monster"), ".")))

recover("font_weight",
        "<p style='font-weight: bold'>Hello</p>",
        doc(p(strong("Hello"))))

function ctx(name, doc, html, openLeft, openRight, slice, parent) {
  defTest("dom_context_" + name, () => {
    let dom = document.createElement("div")
    dom.innerHTML = html
    let result = fromDOMInContext(doc.resolve(doc.tag.a), dom, {openLeft, openRight})
    let expected = slice.slice(slice.tag.a, slice.tag.b)
    cmpStr(result, expected)
    if (parent) cmp(parent, result.possibleParent && result.possibleParent.type.name, "parent")
  })
}

ctx("in_list",
    doc(ul(li(p("foo")), "<a>")),
    "<li>bar</li>", 0, 0,
    ul("<a>", li(p("bar")), "<b>"))

ctx("in_list_item",
    doc(ul(li(p("foo<a>")))),
    "<li>bar</li>", 0, 0,
    ul("<a>", li(p("bar")), "<b>"))

ctx("text_in_text",
    doc(p("foo<a>")),
    "<h1>bar</h1>", 1, 1,
    p("<a>bar<b>"))

ctx("mess",
    doc(p("foo<a>")),
    "<p>a</p>b<li>c</li>", 0, 0,
    doc("<a>", p("a"), p("b"), ol(li(p("c")), "<b>")))

ctx("preserve_type",
    doc(p("<a>")),
    "<h1>bar</h1>", 1, 1,
    p("<a>bar<b>"), 0, 0, "heading")

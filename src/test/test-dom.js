const {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, img, hr} = require("./build")
const {Failure} = require("./failure")
const {cmpNode, cmp, cmpStr} = require("./cmp")
const {defTest} = require("./tests")

const {schema} = require("../schema-basic")
const {parseDOMInContext} = require("../model")

let document = typeof window == "undefined" ? require("jsdom").jsdom() : window.document

function t(name, doc, dom) {
  defTest("dom_" + name, () => {
    let derivedDOM = document.createElement("div")
    derivedDOM.appendChild(doc.content.toDOM({document}))
    let declaredDOM = document.createElement("div")
    declaredDOM.innerHTML = dom

    var derivedText = derivedDOM.innerHTML
    var declaredText = declaredDOM.innerHTML
    if (derivedText != declaredText)
      throw new Failure("DOM text mismatch: " + derivedText + " vs " + declaredText)

    cmpNode(schema.parseDOM(derivedDOM), doc)
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
    cmpNode(schema.parseDOM(dom), doc)
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

recover("ignore_inline_tag",
        "<p><u>a</u>bc</p>",
        doc(p("abc")))

function find(name, html, doc) {
  defTest("dom_find_" + name, () => {
    let dom = document.createElement("div")
    dom.innerHTML = html
    let tag = dom.querySelector("var"), prev = tag.previousSibling, next = tag.nextSibling, pos
    if (prev && next && prev.nodeType == 3 && next.nodeType == 3) {
      pos = {node: prev, offset: prev.nodeValue.length}
      prev.nodeValue += next.nodeValue
      next.parentNode.removeChild(next)
    } else {
      pos = {node: tag.parentNode, offset: Array.prototype.indexOf.call(tag.parentNode.childNodes, tag)}
    }
    tag.parentNode.removeChild(tag)
    let result = schema.parseDOM(dom, {
      findPositions: [pos]
    })
    cmpNode(result, doc)
    cmp(pos.pos, doc.tag.a)
  })
}

find("start_of_para",
     "<p><var></var>hello</p>",
     doc(p("<a>hello")))

find("end_of_para",
     "<p>hello<var></var></p>",
     doc(p("hello<a>")))

find("in_text",
     "<p>hel<var></var>lo</p>",
     doc(p("hel<a>lo")))

find("ignored_node",
     "<p>hi</p><object><var></var>foo</object><p>ok</p>",
     doc(p("hi"), "<a>", p("ok")))

find("between_nodes",
     "<ul><li>foo</li><var></var><li>bar</li></ul>",
     doc(ul(li(p("foo")), "<a>", li(p("bar")))))

find("start_of_doc",
     "<var></var><p>hi</p>",
     doc("<a>", p("hi")))

find("end_of_doc",
     "<p>hi</p><var></var>",
     doc(p("hi"), "<a>"))

function ctx(name, doc, html, openLeft, slice) {
  defTest("dom_context_" + name, () => {
    let dom = document.createElement("div")
    dom.innerHTML = html
    let insert = doc.tag.a, $insert = doc.resolve(insert)
    for (let d = $insert.depth; d > 0 && insert == $insert.start(d) && $insert.end(d) == $insert.after(d + 1); d--) insert--
    let result = parseDOMInContext(doc.resolve(insert), dom, {openLeft})
    let sliceContent = slice.content, sliceEnd = sliceContent.size
    while (sliceContent.lastChild && !sliceContent.lastChild.type.isLeaf) { sliceEnd--; sliceContent = sliceContent.lastChild.content }
    let expected = slice.slice(slice.tag.a, sliceEnd)
    cmpStr(result, expected)
  })
}

ctx("in_list",
    doc(ul(li(p("foo")), "<a>")),
    "<li>bar</li>", 0,
    ul("<a>", li(p("bar"))))

ctx("in_list_item",
    doc(ul(li(p("foo<a>")))),
    "<li>bar</li>", 0,
    ul("<a>", li(p("bar"))))

ctx("text_in_text",
    doc(p("foo<a>")),
    "<h1>bar</h1>", 1,
    p("<a>bar"))

ctx("mess",
    doc(p("foo<a>")),
    "<p>a</p>b<li>c</li>", 0,
    doc("<a>", p("a"), p("b"), ol(li(p("c")))))

ctx("open_fits",
    doc(p("foo<a>")),
    "<p>hello</p><p>there</p>", 1,
    doc(p("<a>hello"), p("there")))

ctx("preserve_type",
    doc(p("<a>")),
    "<h1>bar</h1>", 1,
    doc("<a>", h1("bar")))

ctx("preserve_type_deep",
    doc(p("<a>")),
    "<h1>bar</h1><p>foo</p>", 1,
    doc("<a>", h1("bar"), p("foo")))

ctx("leave_marks",
    doc(pre("<a>")),
    "<p>foo<strong>bar</strong></p>", 1,
    doc("<a>", p("foo", strong("bar"))))

ctx("paste_list",
    doc(p("<a>")),
    "<ol><li><p>foo</p></li><li><p>bar</p></li></ol>", 3,
    doc("<a>", ol(li(p("foo")), li(p("bar")))))

ctx("join_list",
    doc(ol(li(p("x<a>")))),
    "<ol><li><p>foo</p></li><li><p>bar</p></li></ol>", 3,
    doc(ol(li(p("<a>foo")), li(p("bar")))))

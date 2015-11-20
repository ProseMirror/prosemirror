import {doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, hr} from "./build"
import {Failure} from "./failure"
import {cmpNode} from "./cmp"
import {defTest} from "./tests"

import xmlDOM from "xmldom"

import {defaultSchema as schema} from "../src/model"
import {toDOM} from "../src/serialize/dom"
import {fromDOM} from "../src/parse/dom"

function domFor(str) {
  return (new xmlDOM.DOMParser).parseFromString("<!doctype html><html>" + str + "</html>")
}

function domText(dom) {
  var out = "", ser = new xmlDOM.XMLSerializer
  for (var node = dom.documentElement.firstChild; node; node = node.nextSibling)
    out += ser.serializeToString(node)
  return out
}

function t(name, doc, dom) {
  defTest("dom_" + name, () => {
    let derivedDOM = domFor("")
    derivedDOM.documentElement.appendChild(toDOM(doc, {document: derivedDOM}))
    let declaredDOM = domFor(dom)

    var derivedText = domText(derivedDOM)
    var declaredText = domText(declaredDOM)
    if (derivedText != declaredText)
      throw new Failure("DOM text mismatch: " + derivedText + " vs " + declaredText)

    cmpNode(doc, fromDOM(schema, derivedDOM.documentElement))
  })
}

t("simple",
  doc(p("hello")),
  "<p>hello</p>")

t("br",
  doc(p("hi", br, "there")),
  "<p>hi<br/>there</p>")

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
  defTest("dom_recover_" + name, () => cmpNode(fromDOM(schema, domFor(html)), doc))
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
        doc(blockquote(p("woo ", em("hooo")))))

recover("find_place",
        "<ul class=\"tight\"><li>hi</li><p>whoah</p><li>again</li></ul>",
        doc(ul(li(p("hi")), li(p("whoah")), li(p("again")))))

recover("move_up",
        "<p>hello<hr/>bye</p>",
        doc(p("hello"), hr, p("bye")))

recover("dont_ignore_whitespace",
        "<p><em>one</em> <strong>two</strong></p>",
        doc(p(em("one"), " ", strong("two"))))

recover("stray tab",
        "<p> <b>&#09;</b></p>",
        doc(p(" ")))

recover("random spaces",
        "<p><b>1 </b> </p>",
        doc(p(strong("1 "))))

recover("empty code block",
        "<pre></pre>",
        doc(pre()))

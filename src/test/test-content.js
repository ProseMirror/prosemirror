import {ContentExpr} from "../model/content"
import {defaultSchema as schema} from "../model"

import {defTest} from "./tests"
import {doc, p, pre, img, br, h1, em, hr} from "./build"
import {cmp, cmpNode, is} from "./cmp"

function get(expr) { return ContentExpr.parse(schema.nodes.heading, expr, schema.spec.groups) }

function simplify(elt) {
  return {types: elt.nodeTypes.map(t => t.name).sort(),
          marks: Array.isArray(elt.marks) ? elt.marks.map(m => m.name) : elt.marks,
          min: elt.min, max: elt.max == 2e9 ? Infinity : elt.max, mod: elt.mod}
}

function normalize(obj) {
  return {types: obj.types.sort(),
          marks: obj.marks || false,
          min: obj.min == null ? 1 : obj.min,
          max: obj.max == null ? 1 : obj.max,
          mod: obj.mod == null ? -1 : obj.mod}
}

function parse(name, expr, ...expected) {
  defTest("content_parse_" + name, () => {
    cmp(JSON.stringify(get(expr).elements.map(simplify)), JSON.stringify(expected.map(normalize)))
  })
}

parse("plain", "paragraph", {types: ["paragraph"]})
parse("sequence", "heading paragraph heading",
      {types: ["heading"]},
      {types: ["paragraph"]},
      {types: ["heading"]})

parse("one_or_more", "paragraph+",
      {types: ["paragraph"], max: Infinity})
parse("zero_or_more", "paragraph*",
      {types: ["paragraph"], min: 0, max: Infinity})
parse("optional", "paragraph?",
      {types: ["paragraph"], min: 0, max: 1})

parse("all_marks", "text<_>", {types: ["text"], marks: true})
parse("some_marks", "text<strong em>", {types: ["text"], marks: ["strong", "em"]})

parse("set", "(text | image | hard_break)",
      {types: ["text", "image", "hard_break"]})
parse("set_repeat", "(text | image | hard_break)+",
      {types: ["text", "image", "hard_break"], max: Infinity})
parse("group", "inline*",
      {types: ["image", "text", "hard_break"], min: 0, max: Infinity})

parse("modulo", "paragraph%10",
      {types: ["paragraph"], mod: 10, min: 10, max: Infinity})

parse("range_count", "paragraph{2}",
      {types: ["paragraph"], min: 2, max: 2})
parse("range_between", "paragraph{2, 5}",
      {types: ["paragraph"], min: 2, max: 5})
parse("range_open", "paragraph{2,}",
      {types: ["paragraph"], min: 2, max: Infinity})

parse("modulo_attr", "paragraph%.level",
      {types: ["paragraph"], mod: ["level"], min: ["level"], max: Infinity})
parse("range_attr", "paragraph{.level}",
      {types: ["paragraph"], min: ["level"], max: ["level"]})

function parseFail(name, expr) {
  defTest("content_parse_fail_" + name, () => {
    try {
      ContentExpr.parse(schema.nodes.heading, expr, schema.spec.groups)
      is(false, "parsing succeeded")
    } catch(e) {
      if (!(e instanceof SyntaxError)) throw e
    }
  })
}

parseFail("invalid_char", "paragraph/image")
parseFail("adjacent", "paragraph paragraph")
parseFail("adjacent_set", "inline image")
parseFail("bad_attr", "hard_break{.foo}")
parseFail("bad_node", "foo+")
parseFail("bad_mark", "hard_break<bar>")
parseFail("weird_mark", "image<_ em>")
parseFail("trailing_noise", "hard_break+ text* .")
parseFail("zero_times", "image{0}")

const attrs = {level: 3}

function testValid(expr, frag, isValid) {
  cmp(get(expr).matches(attrs, frag.content), isValid)
}

function valid(name, expr, frag) {
  defTest("content_valid_" + name, () => testValid(expr, frag, true))
}
function invalid(name, expr, frag) {
  defTest("content_invalid_" + name, () => testValid(expr, frag, false))
}

valid("nothing_empty", "", p())
invalid("nothing_non_empty", "", p(img))

valid("star_empty", "image*", p())
valid("star_one", "image*", p(img))
valid("star_multiple", "image*", p(img, img, img, img, img))
invalid("star_different", "image*", p(img, "text"))

valid("group", "inline", p(img))
invalid("group", "inline", doc(p()))
valid("star_group", "inline*", p(img, "text"))
valid("set", "(paragraph | heading)", doc(p()))
invalid("set", "(paragraph | heading)", p(img))

valid("seq_simple", "paragraph horizontal_rule paragraph", p(p(), hr, p()))
invalid("seq_too_long", "paragraph horizontal_rule", p(p(), hr, p()))
invalid("seq_too_short", "paragraph horizontal_rule paragraph", p(p(), hr))
invalid("seq_wrong_start", "paragraph horizontal_rule", p(hr, p(), hr))

valid("seq_star_single", "heading paragraph*", doc(h1()))
valid("seq_star_multiple", "heading paragraph*", doc(h1(), p(), p()))
valid("seq_plus_one", "heading paragraph+", doc(h1(), p()))
valid("seq_plus_two", "heading paragraph+", doc(h1(), p(), p()))
invalid("seq_plus_none", "heading paragraph+", doc(h1()))
invalid("seq_plus_start_missing", "heading paragraph+", doc(p(), p()))
valid("opt_present", "image?", p(img))
valid("opt_not_present", "image?", p())
invalid("opt_two", "image?", p(img, img))

valid("count_ok", "hard_break{2}", p(br, br))
invalid("count_too_few", "hard_break{2}", p(br))
invalid("count_too_many", "hard_break{2}", p(br, br, br))
valid("range_lower_bound", "hard_break{2, 4}", p(br, br))
valid("range_upper_bound", "hard_break{2, 4}", p(br, br, br, br))
invalid("range_too_few", "hard_break{2, 4}", p(br))
invalid("range_too_many", "hard_break{2, 4}", p(br, br, br, br, br))
invalid("range_bad_after", "hard_break{2, 4} text*", p(br, br, img))
valid("range_good_after", "hard_break{2, 4} image?", p(br, br, img))
valid("open_range_lower_bound", "hard_break{2,}", p(br, br))
valid("open_range_many", "hard_break{2,}", p(br, br, br, br, br))
invalid("open_range_too_few", "hard_break{2,}", p(br))

valid("mod_once", "hard_break%3", p(br, br, br))
valid("mod_twice", "hard_break%3", p(br, br, br, br, br, br))
invalid("mod_none", "hard_break%3", p())
invalid("mod_no_fit", "hard_break%3", p(br, br, br, br))

valid("mark_all", "hard_break<_>", p(em(br)))
invalid("mark_none", "hard_break", p(em(br)))
valid("mark_some", "hard_break<em strong>", p(em(br)))
invalid("mark_some", "hard_break<code strong>", p(em(br)))

valid("count_attr", "hard_break{.level}", p(br, br, br))
invalid("count_attr", "hard_break{.level}", p(br, br))
valid("count_attr_deep", "hard_break{.level.constructor.length}", p(br))
invalid("count_attr_deep", "hard_break{.level.constructor.length}", p(br, br))

function fill(name, expr, before, after, result) {
  defTest("content_fill_" + name, () => {
    let filled = get(expr).getMatchAt(attrs, before.content).fillBefore(after.content, true)
    if (result) is(filled, "Failed unexpectedly"), cmpNode(filled, result.content)
    else is(!filled, "Succeeded unexpectedly")
  })
}

fill("simple_seq_nothing", "paragraph horizontal_rule paragraph",
     doc(p(), hr), doc(p()), doc())
fill("simple_seq_one", "paragraph horizontal_rule paragraph",
     doc(p()), doc(p()), doc(hr))

fill("star_both_sides", "hard_break*",
     p(br), p(br), p())
fill("star_only_left", "hard_break*",
     p(br), p(), p())
fill("star_only_right", "hard_break*",
     p(), p(br), p())
fill("star_neither", "hard_break*",
     p(), p(), p())
fill("plus_both_sides", "hard_break+",
     p(br), p(br), p())
fill("plus_neither", "hard_break+",
     p(), p(), p(br))
fill("plus_mismatch", "hard_break+",
     p(), p(img), null)

fill("seq_stars", "heading* paragraph*",
     doc(h1()), doc(p()), doc())
fill("seq_stars_empty_after", "heading* paragraph*",
     doc(h1()), doc(), doc())
fill("seq_plus", "heading+ paragraph+",
     doc(h1()), doc(p()), doc())
fill("seq_empty_after", "heading+ paragraph+",
     doc(h1()), doc(), doc(p()))

fill("mod_add_mid", "hard_break%3",
     p(br), p(br), p(br))
fill("mod_add_front", "hard_break%3",
     p(), p(br), p(br, br))
fill("mod_add_end", "hard_break%3",
     p(br), p(), p(br, br))
fill("mod_add_extra", "hard_break%3",
     p(br, br), p(br, br), p(br, br))

fill("count_too_few", "hard_break{3}",
     p(br), p(br), p(br))
fill("count_too_many", "hard_break{3}",
     p(br, br), p(br, br), null)
fill("count_left_right", "code_block{2} paragraph{2}",
     doc(pre()), doc(p()), doc(pre(), p()))

function fill3(name, expr, before, mid, after, left, right) {
  defTest("content_fill3_" + name, () => {
    let content = get(expr)
    let a = content.getMatchAt(attrs, before.content).fillBefore(mid.content)
    let b = a && content.getMatchAt(attrs, before.content.append(a).append(mid.content)).fillBefore(after.content, true)
    if (left) is(b, "Failed unexpectedly"), cmpNode(a, left.content), cmpNode(b, right.content)
    else is(!b, "Succeeded unexpectedly")
  })
}

fill3("simple_seq", "paragraph horizontal_rule paragraph horizontal_rule paragraph",
      doc(p()), doc(p()), doc(p()), doc(hr), doc(hr))
fill3("seq_plus_ok", "code_block+ paragraph+",
      doc(pre()), doc(pre()), doc(p()), doc(), doc())
fill3("seq_plus_from_empty", "code_block+ paragraph+",
      doc(), doc(), doc(), doc(), doc(pre(), p()))
fill3("seq_count", "code_block{3} paragraph{3}",
      doc(pre()), doc(p()), doc(), doc(pre(), pre()), doc(p(), p()))
fill3("invalid", "paragraph*",
      doc(p()), doc(pre()), doc(p()), null)

fill3("count_across", "paragraph{4}",
      doc(p()), doc(p()), doc(p()), doc(), doc(p()))
fill3("count_across_invalid", "paragraph{2}",
      doc(p()), doc(p()), doc(p()), null)
fill3("mod_across", "paragraph%4",
      doc(p()), doc(p()), doc(p()), doc(), doc(p()))
fill3("mod_across_multiple", "paragraph%4",
      doc(p()), doc(p(), p()), doc(p(), p()), doc(), doc(p(), p(), p()))

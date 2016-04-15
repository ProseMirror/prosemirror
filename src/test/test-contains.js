import {ContainsExpr} from "../model/contains"
import {defaultSchema as schema} from "../model"

import {defTest} from "./tests"
import {doc, p, img, br, h1, em} from "./build"
import {cmp} from "./cmp"

function simplify(elt) {
  return {types: elt.nodeTypes.map(t => t.name).sort(),
          marks: Array.isArray(elt.marks) ? elt.marks.map(m => m.name) : elt.marks,
          min: elt.min, max: elt.max == 1e8 ? Infinity : elt.max, mod: elt.mod}
}

function normalize(obj) {
  return {types: obj.types.sort(),
          marks: obj.marks || false,
          min: obj.min == null ? 1 : obj.min,
          max: obj.max == null ? 1 : obj.max,
          mod: obj.mod == null ? -1 : obj.mod}
}

function parse(name, expr, ...expected) {
  defTest("contains_" + name, () => {
    let parsed = ContainsExpr.parse(schema.nodes.heading, expr)
    cmp(JSON.stringify(parsed.elements.map(simplify)), JSON.stringify(expected.map(normalize)))
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

parse("all_marks", "image[_]", {types: ["image"], marks: true})
parse("some_marks", "image[strong em]", {types: ["image"], marks: ["strong", "em"]})

parse("set", "(image | text | hard_break)",
      {types: ["image", "text", "hard_break"]})
parse("set_repeat", "(image | text | hard_break)+",
      {types: ["image", "text", "hard_break"], max: Infinity})
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

parse("modulo_attr", "paragraph%@level",
      {types: ["paragraph"], mod: "level", min: "level", max: Infinity})
parse("range_attr", "paragraph{@level}",
      {types: ["paragraph"], min: "level", max: "level"})

const attrs = {level: 3}

function testValid(expr, frag, isValid) {
  let parsed = ContainsExpr.parse(schema.nodes.heading, expr)
  cmp(!!parsed.matches(attrs, frag.content), isValid)
}

function valid(name, expr, frag) {
  defTest("contains_valid_" + name, () => testValid(expr, frag, true))
}
function invalid(name, expr, frag) {
  defTest("contains_invalid_" + name, () => testValid(expr, frag, false))
}

valid("star_empty", "image*", p())
valid("star_one", "image*", p(img))
valid("star_multiple", "image*", p(img, img, img, img, img))
invalid("star_different", "image*", p(img, "text"))

valid("group", "inline", p(img))
invalid("group", "inline", doc(p()))
valid("star_group", "inline*", p(img, "text"))
valid("set", "(paragraph | heading)", doc(p()))
invalid("set", "(paragraph | heading)", p(img))

valid("seq_simple", "image hard_break image", p(img, br, img))
invalid("seq_too_long", "image hard_break", p(img, br, img))
invalid("seq_too_short", "image hard_break image", p(img, br))
invalid("seq_wrong_start", "image hard_break", p(br, img, br))

valid("seq_star_single", "heading paragraph*", doc(h1()))
valid("seq_star_multiple", "heading paragraph*", doc(h1(), p(), p()))
valid("seq_plus_one", "heading paragraph+", doc(h1(), p()))
valid("seq_plus_two", "heading paragraph+", doc(h1(), p(), p()))
invalid("seq_plus_none", "heading paragraph+", doc(h1()))
invalid("seq_plus_start_missing", "heading paragraph+", doc(p(), p()))
valid("opt_present", "image?", p(img))
valid("opt_not_present", "image?", p())
invalid("opt_two", "image?", p(img, img))

valid("count_ok", "image{2}", p(img, img))
invalid("count_too_few", "image{2}", p(img))
invalid("count_too_many", "image{2}", p(img, img, img))
valid("range_lower_bound", "image{2, 4}", p(img, img))
valid("range_upper_bound", "image{2, 4}", p(img, img, img, img))
invalid("range_too_few", "image{2, 4}", p(img))
invalid("range_too_many", "image{2, 4}", p(img, img, img, img, img))
invalid("range_bad_after", "image{2, 4}", p(img, img, br))
valid("range_good_after", "image{2, 4} hard_break", p(img, img, br))
valid("open_range_lower_bound", "image{2,}", p(img, img))
valid("open_range_many", "image{2,}", p(img, img, img, img, img))
invalid("open_range_too_few", "image{2,}", p(img))

valid("mod_once", "image%3", p(img, img, img))
valid("mod_twice", "image%3", p(img, img, img, img, img, img))
invalid("mod_none", "image%3", p())
invalid("mod_no_fit", "image%3", p(img, img, img, img))

valid("mark_all", "image[_]", p(em(img)))
invalid("mark_none", "image", p(em(img)))
valid("mark_some", "image[em strong]", p(em(img)))
invalid("mark_some", "image[code strong]", p(em(img)))

valid("count_attr", "image{@level}", p(img, img, img))
invalid("count_attr", "image{@level}", p(img, img))

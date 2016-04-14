import {ContainsExpr} from "../model/contains"
import {defaultSchema as schema} from "../model"

import {defTest} from "./tests"
import {doc, p, ul, li, pre} from "./build"
import {cmp, cmpNode} from "./cmp"

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

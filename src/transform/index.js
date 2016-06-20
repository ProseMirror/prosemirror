;({Transform: exports.Transform, TransformError: exports.TransformError} = require("./transform"))
;({Step: exports.Step, StepResult: exports.StepResult} = require("./step"))
;({joinPoint: exports.joinPoint, joinable: exports.joinable, canSplit: exports.canSplit,
   insertPoint: exports.insertPoint, liftTarget: exports.liftTarget, findWrapping: exports.findWrapping} = require("./structure"))
;({PosMap: exports.PosMap, MapResult: exports.MapResult, Remapping: exports.Remapping,
   mapThrough: exports.mapThrough, mapThroughResult: exports.mapThroughResult} = require("./map"))
;({AddMarkStep: exports.AddMarkStep, RemoveMarkStep: exports.RemoveMarkStep} = require("./mark_step"))
;({ReplaceStep: exports.ReplaceStep, ReplaceAroundStep: exports.ReplaceAroundStep} = require("./replace_step"))
require("./mark")
require("./replace")

// !! This module defines a way to transform documents. Transforming
// happens in `Step`s, which are atomic, well-defined modifications to
// a document. [Applying](#Step.apply) a step produces a new
// document.
//
// Each step provides a [position map](#PosMap) that maps positions in
// the old document to position in the new document. Steps can be
// [inverted](#Step.invert) to create a step that undoes their effect,
// and chained together in a convenience object called a `Transform`.
//
// This module does not depend on the browser API being available
// (i.e. you can load it into any JavaScript environment).
//
// You can read more about transformations in [this
// guide](guide/transform.md).

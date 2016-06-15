const {copyObj} = require("../util/obj")

copyObj(require("./prompt"), exports)
exports.Tooltip = require("./tooltip").Tooltip

// !! This module implements some GUI primitives.
//
// The prompting implementation gets the job done, roughly, but it's
// rather primitive and you'll probably want to replace it in your own
// system (or submit patches to improve this implementation).

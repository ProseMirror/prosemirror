const tests = Object.create(null)
exports.tests = tests

// : (string, Function)
// Define a test. A test should include a descriptive name and
// a function which runs the test. If a test fails, it should
// throw a Failure.
function defTest(name, f) {
  if (name in tests) throw new Error("Duplicate definition of test " + name)
  tests[name] = f
}
exports.defTest = defTest

function filter(name, filters) {
  if (!filters.length) return true
  for (let i = 0; i < filters.length; i++)
    if (name.indexOf(filters[i]) == 0) return true
  return false
}
exports.filter = filter

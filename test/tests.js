export const tests = Object.create(null)

export function defTest(name, f) {
  if (name in tests) throw new Error("Duplicate definition of test " + name)
  tests[name] = f
}

export const tests = Object.create(null)

export function defTest(name, f) {
  if (name in tests) throw new Error("Duplicate definition of test " + name)
  tests[name] = f
}

export function filter(name, filters) {
  if (!filters.length) return true
  for (let i = 0; i < filters.length; i++)
    if (name.indexOf(filters[i]) == 0) return true
  return false
}

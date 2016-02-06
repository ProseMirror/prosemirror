export function copyObj(obj, base) {
  let copy = base || Object.create(null)
  for (let prop in obj) copy[prop] = obj[prop]
  return copy
}

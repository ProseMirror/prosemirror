function pad(str, len) {
  while (str.length < len) str = "0" + str
  return str
}

export function randomID() {
  return pad(Math.floor(Math.random() * 0xffffffffff).toString(16), 10)
}

export function xorIDs(a, b) {
  let hiA = parseInt(a.slice(0, 5), 16)
  let loA = parseInt(a.slice(5), 16)
  let hiB = parseInt(b.slice(0, 5), 16)
  let loB = parseInt(b.slice(5), 16)
  return pad((hiA ^ hiB).toString(16), 5) +
         pad((loA ^ loB).toString(16), 5)
}

export const nullID = "0000000000"

// Generating and manipulating 48-bit ID values
// Stored as JS numbers

const two48 = Math.pow(2, 48)
const max48 = two48 - 1
const two24 = Math.pow(2, 24)
const max24 = two24 - 1

export function randomID() {
  return Math.floor(Math.random() * max48)
}

function lo24(id) { return id & max24 }
// Can't use bitwise operators to get at higher bits, because those
// clamp their operands to 32 bits
function hi24(id) { return Math.floor(id / two24) }

function hilo(hi, lo) { return hi * two24 + lo }

export function xorIDs(a, b) {
  return hilo(hi24(a) ^ hi24(b), lo24(a) ^ lo24(b))
}

const bit47 = Math.pow(2, 47)

export function rotateIDLeft(id) {
  let bit = id % 2
  return (id - bit) / 2 + bit * bit47
}

export function rotateIDRight(id) {
  let bit = id >= bit47
  return (id - bit * bit47) * 2 + bit
}


// The rotation is done so that 
export function childID(parent, change) {
  return rotateIDLeft(xorIDs(parent, change))
}

export function parentID(child, change) {
  return xorIDs(rotateIDRight(child), change)
}

export function changeID(child, parent) {
  return xorIDs(rotateIDRight(child), parent)
}

export const nullID = 0

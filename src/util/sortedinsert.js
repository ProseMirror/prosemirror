export default function sortedInsert(array, elt, compare) {
  let i = 0
  for (; i < array.length; i++)
    if (compare(array[i], elt) > 0) break
  array.splice(i, 0, elt)
}

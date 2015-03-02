export const code = {type: "code"}
export const em = {type: "em"}
export const strong = {type: "strong"}

export function link(href, title) {
  return {type: "link", href: href, title: title || null}
}

export const ordering = ["em", "strong", "link", "code"]

export function add(styles, style) {
  var order = ordering.indexOf(style.type)
  for (var i = 0; i < styles.length; i++) {
    var other = styles[i]
    if (other.type == style.type) {
      if (same(other, style)) return styles
      else return styles.slice(0, i).concat(style).concat(styles.slice(i + 1))
    }
    if (ordering.indexOf(other.type) < order)
      return styles.slice(0, i).concat(style).concat(styles.slice(i))
  }
  return styles.concat(style)
}

export function remove(styles, style) {
  for (var i = 0; i < styles.length; i++)
    if (same(style, styles[i]))
      return styles.slice(0, i).concat(styles.slice(i + 1))
  return styles
}

export function sameSet(a, b) {
  if (a.length != b.length) return false
  for (let i = 0; i < a.length; i++)
    if (!same(a[i], b[i])) return false
  return true
}

export function same(a, b) {
  if (a == b) return true
  for (let prop in a)
    if (a[prop] != b[prop]) return false
  for (let prop in b)
    if (a[prop] != b[prop]) return false
  return true
}

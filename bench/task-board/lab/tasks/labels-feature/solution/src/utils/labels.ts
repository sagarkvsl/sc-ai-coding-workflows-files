export function parseLabels(text: string): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const part of text.split(',')) {
    const label = part.trim()
    const key = label.toLowerCase()
    if (label === '' || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

export function labelsToText(labels: string[]): string {
  return labels.join(', ')
}

export function hasLabel(labels: string[], wanted: string): boolean {
  const key = wanted.toLowerCase()
  return labels.some((label) => label.toLowerCase() === key)
}

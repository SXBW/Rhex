function stringToHue(input: string) {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash)
  }

  return Math.abs(hash) % 360
}

export function getAvatarFallback(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    return "U"
  }

  const characters = Array.from(trimmed.replace(/\s+/g, ""))
  const fallback = characters[0]

  return (fallback || "U").toUpperCase()
}

export function getAvatarColor(name: string) {
  const coolTonePalette = [
    { background: "hsl(258 24% 91%)", foreground: "hsl(258 24% 30%)" },
    { background: "hsl(238 24% 91%)", foreground: "hsl(238 25% 30%)" },
    { background: "hsl(218 28% 91%)", foreground: "hsl(218 28% 29%)" },
    { background: "hsl(203 24% 90%)", foreground: "hsl(203 26% 28%)" },
    { background: "hsl(215 16% 90%)", foreground: "hsl(215 18% 29%)" },
    { background: "hsl(225 10% 89%)", foreground: "hsl(225 12% 28%)" },
  ] as const

  return coolTonePalette[stringToHue(name) % coolTonePalette.length]
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function createGeneratedAvatarDataUrl(name: string) {
  const fallback = escapeSvgText(getAvatarFallback(name))
  const colors = getAvatarColor(name)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${fallback}">
      <rect width="96" height="96" rx="24" fill="${colors.background}" />
      <text x="50%" y="51%" dominant-baseline="central" text-anchor="middle" fill="${colors.foreground}" font-family="ui-rounded, 'SF Pro Rounded', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" font-size="32" font-weight="650" letter-spacing="0.5">${fallback}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function getAvatarUrl(avatarPath: string | null | undefined, name: string) {
  if (avatarPath && avatarPath.trim()) {
    return avatarPath
  }

  return createGeneratedAvatarDataUrl(name)
}

import ts from 'typescript'
import { describe, expect } from 'vitest'
import { cssFiles, parse, readSrc, readTarget, requireSources, visit } from '../support/project'
import { style } from '../support/tags'

const FILES = ['variables.css', 'base.css', 'layout.css', 'components.css']

function css(name: string): string {
  const text = readSrc(`styles/${name}`)
  if (text === null) throw new Error(`src/styles/${name} is missing`)
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

function allCss(): { rel: string; text: string }[] {
  const files = cssFiles()
  if (files.length < 2) throw new Error('fewer than 2 CSS files found')
  return files.map((f) => ({ rel: f.rel, text: f.text.replace(/\/\*[\s\S]*?\*\//g, '') }))
}

function selectors(text: string): string[] {
  return [...text.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'))
}

describe('R-STYLE: styles and HTML shell', () => {
  style(3, 'four stylesheets exist in src/styles/ and are imported by the app', () => {
    for (const name of FILES) expect(readSrc(`styles/${name}`), name).not.toBeNull()
    const entry = `${readSrc('main.tsx') ?? ''}\n${readSrc('App.tsx') ?? ''}`
    for (const name of FILES) expect(entry, name).toContain(name)
  })

  style(3, 'variables.css defines at least 12 custom properties: colours, spacing and radius', () => {
    const text = css('variables.css')
    const names = [...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
    expect(names.length).toBeGreaterThanOrEqual(12)
    expect(names.filter((n) => /color|bg|text|border/.test(n)).length).toBeGreaterThanOrEqual(5)
    expect(names.filter((n) => /space|gap|spacing/.test(n)).length).toBeGreaterThanOrEqual(3)
    expect(names.some((n) => /radius/.test(n))).toBe(true)
  })

  style(4, 'colours are written only in variables.css; elsewhere they come from var(--…)', () => {
    const offenders = allCss()
      .filter((f) => !f.rel.endsWith('variables.css'))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
    const uses = allCss().reduce((n, f) => n + (f.text.match(/var\(--/g) ?? []).length, 0)
    expect(uses).toBeGreaterThanOrEqual(30)
  })

  style(3, 'no !important and no id selectors', () => {
    const files = allCss()
    expect(files.filter((f) => /!important/.test(f.text)).map((f) => f.rel)).toEqual([])
    const withIds = files.filter((f) => selectors(f.text).some((s) => /(^|[\s,>+~])#[A-Za-z_-]/.test(s)))
    expect(withIds.map((f) => f.rel)).toEqual([])
  })

  style(3, 'class names follow one consistent kebab-case / BEM pattern', () => {
    const pattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$/
    const bad = new Set<string>()
    for (const file of allCss()) {
      for (const selector of selectors(file.text)) {
        for (const match of selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) {
          if (!pattern.test(match[1])) bad.add(match[1])
        }
      }
    }
    expect([...bad]).toEqual([])
  })

  style(3, 'the layout uses grid or flex and has a responsive media query for the board', () => {
    const text = allCss().map((f) => f.text).join('\n')
    expect((text.match(/display:\s*(grid|flex)/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const media = [...text.matchAll(/@media[^{]*\{([\s\S]*?\})\s*\}/g)]
    expect(media.length).toBeGreaterThanOrEqual(1)
    expect(text).toMatch(/@media[^{]*(max|min)-width/)
    expect(media.some((m) => /grid-template-columns|flex-direction|flex-wrap/.test(m[1]))).toBe(true)
  })

  style(2, 'keyboard focus is styled with :focus-visible and outlines are never removed bare', () => {
    const text = allCss().map((f) => f.text).join('\n')
    expect(text).toMatch(/:focus-visible/)
    if (/outline:\s*(none|0)\b/.test(text)) expect(text).toMatch(/:focus-visible[^{]*\{[^}]*(outline|box-shadow)/)
  })

  style(2, 'a global box-sizing: border-box rule exists', () => {
    expect(allCss().map((f) => f.text).join('\n')).toMatch(/box-sizing:\s*border-box/)
  })

  style(2, 'if transitions or animations are used, prefers-reduced-motion is respected', () => {
    const text = allCss().map((f) => f.text).join('\n')
    expect(text.length).toBeGreaterThan(200)
    if (/\b(transition|animation)\s*:/.test(text)) expect(text).toMatch(/prefers-reduced-motion/)
  })

  style(2, 'font sizes use rem/em or variables, never px', () => {
    const text = allCss().map((f) => f.text).join('\n')
    expect(text.length).toBeGreaterThan(200)
    expect(text).not.toMatch(/font-size:\s*\d+(\.\d+)?px/)
  })

  style(3, 'class names used in components are defined in the CSS (styles are really applied)', () => {
    const defined = new Set<string>()
    for (const file of allCss()) {
      for (const selector of selectors(file.text)) {
        for (const match of selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) defined.add(match[1])
      }
    }
    const used = new Set<string>()
    for (const file of requireSources().filter((f) => f.rel.endsWith('.tsx'))) {
      const sf = parse(file)
      visit(sf, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText() !== 'className' || !node.initializer) return
        const text = node.initializer.getText().replace(/\$\{[^}]*\}/g, ' ')
        for (const token of text.replace(/[`'"{}]/g, ' ').split(/\s+/)) {
          if (/^[a-z][a-z0-9_-]*$/.test(token) && !token.endsWith('--') && !token.endsWith('-')) used.add(token)
        }
      })
    }
    expect(used.size).toBeGreaterThanOrEqual(15)
    const missing = [...used].filter((c) => !defined.has(c))
    expect(missing.length / used.size).toBeLessThanOrEqual(0.1)
  })

  style(3, 'there are no inline styles in the components', () => {
    const offenders: string[] = []
    for (const file of requireSources().filter((f) => f.rel.endsWith('.tsx'))) {
      visit(parse(file), (node) => {
        if (ts.isJsxAttribute(node) && node.name.getText() === 'style') offenders.push(file.rel)
      })
    }
    expect(offenders).toEqual([])
  })

  style(3, 'index.html is a valid shell: doctype, lang, charset, viewport, title, root, module script', () => {
    const html = readTarget('index.html') ?? ''
    expect(html).toMatch(/^\s*<!doctype html>/i)
    expect(html).toMatch(/<html[^>]*\blang="[a-z-]+"/i)
    expect(html).toMatch(/<meta[^>]*charset/i)
    expect(html).toMatch(/<meta[^>]*name="viewport"[^>]*width=device-width/i)
    expect(html).toMatch(/<title>\s*Task Board\s*<\/title>/)
    expect(html).toMatch(/<div[^>]*id="root"/)
    expect(html).toMatch(/<script[^>]*type="module"[^>]*src="\/src\/main\.tsx"/)
  })
})

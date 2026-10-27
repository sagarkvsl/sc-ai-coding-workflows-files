import { screen, within } from '@testing-library/react'
import { computeAccessibleName } from 'dom-accessibility-api'
import { describe, expect } from 'vitest'
import { makeTask, seedTasks } from '../support/fixtures'
import { addTask, form, renderApp, useFixedToday } from '../support/render'
import { style } from '../support/tags'

useFixedToday()

async function busyApp() {
  const ctx = await renderApp([
    ...seedTasks(),
    makeTask({ title: 'Overdue one', dueDate: '2026-06-01', description: 'detail' }),
  ])
  await ctx.user.click(screen.getByRole('button', { name: 'Edit Write docs' }))
  await ctx.user.click(screen.getByRole('button', { name: 'Edit Plan sprint' }))
  await ctx.user.click(screen.getByRole('button', { name: 'Delete Overdue one' }))
  await addTask(ctx.user, { dueDate: '2026-06-01' }) // shows both form errors
  return ctx
}

describe('R-HTML: semantic HTML and accessibility', () => {
  style(3, 'there is exactly one banner, one main and one h1', async () => {
    await renderApp(seedTasks())
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  style(3, 'heading levels never skip a level (h1 > h2 > h3)', async () => {
    await busyApp()
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)))
    expect(levels[0]).toBe(1)
    levels.slice(1).forEach((level, i) => expect(level - levels[i]).toBeLessThanOrEqual(1))
  })

  style(4, 'every input, select and textarea has an accessible name', async () => {
    await busyApp()
    const controls = Array.from(document.querySelectorAll('input, select, textarea'))
    expect(controls.length).toBeGreaterThan(8)
    for (const control of controls) {
      expect(computeAccessibleName(control).trim(), control.outerHTML).not.toBe('')
    }
  })

  style(3, 'every button has an accessible name and an explicit type', async () => {
    await busyApp()
    const buttons = Array.from(document.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThan(8)
    for (const button of buttons) {
      expect(computeAccessibleName(button).trim(), button.outerHTML).not.toBe('')
      expect(['button', 'submit'], button.outerHTML).toContain(button.getAttribute('type'))
    }
  })

  style(3, 'no id appears twice, even with several forms open', async () => {
    await busyApp()
    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id)
    expect(ids.length).toBeGreaterThan(5)
    expect(new Set(ids).size).toBe(ids.length)
  })

  style(3, 'every id referenced by for, aria-labelledby or aria-describedby exists', async () => {
    await busyApp()
    const refs: string[] = []
    document.querySelectorAll('label[for]').forEach((el) => refs.push(el.getAttribute('for') ?? ''))
    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      document.querySelectorAll(`[${attr}]`).forEach((el) =>
        (el.getAttribute(attr) ?? '').split(/\s+/).forEach((id) => refs.push(id)),
      )
    }
    expect(refs.length).toBeGreaterThan(5)
    for (const id of refs) expect(document.getElementById(id), `#${id}`).not.toBeNull()
  })

  style(3, 'cards are articles inside list items of a list', async () => {
    await renderApp(seedTasks())
    for (const article of screen.getAllByRole('article')) {
      expect(article.closest('li')).not.toBeNull()
      expect(article.closest('ul, ol')).not.toBeNull()
    }
  })

  style(2, 'columns are <section> landmarks with a name and filters are a named region', async () => {
    await renderApp(seedTasks())
    for (const name of ['To do', 'In progress', 'Done', 'Filters']) {
      expect(screen.getByRole('region', { name })).toBeVisible()
    }
  })

  style(3, 'interaction uses native controls: no clickable div/span and no positive tabindex', async () => {
    await busyApp()
    expect(document.querySelectorAll('[role="button"], div[tabindex], span[tabindex]')).toHaveLength(0)
    document.querySelectorAll('[tabindex]').forEach((el) => {
      expect(Number(el.getAttribute('tabindex'))).toBeLessThanOrEqual(0)
    })
  })

  style(2, 'form errors are announced with role="alert" and tied to their field', async () => {
    await busyApp()
    const alerts = within(form('Add task')).getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    for (const alert of alerts) {
      const owner = document.querySelector(`[aria-describedby~="${alert.id}"]`)
      expect(owner, alert.textContent ?? '').not.toBeNull()
    }
  })

  style(2, 'the add form and the edit forms are named forms', async () => {
    await busyApp()
    expect(form('Add task')).toBeVisible()
    expect(form('Edit Write docs')).toBeVisible()
    expect(form('Edit Plan sprint')).toBeVisible()
  })

  style(1, 'buttons that act on a card say which card in their accessible name', async () => {
    await renderApp(seedTasks())
    const card = screen.getByRole('article', { name: 'Fix login bug' })
    for (const button of within(card).getAllByRole('button')) {
      expect(computeAccessibleName(button)).toContain('Fix login bug')
    }
  })
})

'use client'

/**
 * In bubble phase: runs after field-level handlers so Enter can still be used for
 * chip/email flows that call preventDefault. Skips contenteditable (screenplay editor).
 */
function shouldOfferEnterSubmit(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return false
  if (target.closest('[contenteditable="true"]')) return false
  if (target.closest('[data-prevent-form-enter-submit="true"]')) return false

  if (target.tagName === 'TEXTAREA') return false
  if (target.tagName === 'BUTTON') return false

  if (target.tagName === 'INPUT') {
    const input = target as HTMLInputElement
    const type = (input.type || 'text').toLowerCase()
    const exclude = new Set([
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'file',
      'hidden',
      'image',
    ])
    if (exclude.has(type)) return false
    return true
  }

  if (target.tagName === 'SELECT') return false
  return false
}

function clickDialogPrimaryIfPresent(target: HTMLElement) {
  const dialog = target.closest('[role="dialog"]')
  if (!dialog) return
  const explicit = dialog.querySelector(
    'button[type="submit"]:not([disabled])',
  ) as HTMLButtonElement | null
  if (explicit) {
    explicit.click()
    return
  }
  const actions = dialog.querySelector('.MuiDialogActions-root')
  if (!actions) return
  const buttons = Array.from(actions.querySelectorAll('button')).filter((b) => !b.disabled)
  const primary = buttons[buttons.length - 1]
  if (primary) primary.click()
}

export function attachGlobalFormEnterSubmit(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (e.defaultPrevented) return
    if (e.repeat) return
    if (e.isComposing) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    if (!shouldOfferEnterSubmit(e.target)) return

    const t = e.target as HTMLElement
    const form = t.closest('form')
    if (form) {
      e.preventDefault()
      form.requestSubmit()
      return
    }

    if (!t.closest('[role="dialog"]')) return

    e.preventDefault()
    clickDialogPrimaryIfPresent(t)
  }

  document.addEventListener('keydown', onKeyDown, false)
  return () => document.removeEventListener('keydown', onKeyDown, false)
}

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// React Testing Library only auto-registers cleanup when test globals are
// exposed; we import from `vitest` explicitly, so clean up manually.
afterEach(cleanup)
// Tests stub globals (e.g. Notification); never leak them between tests.
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

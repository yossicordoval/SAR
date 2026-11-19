import { createStudy } from './study-state.js'

export const PROGRESS_KEY = 'sarcade-learning'
export const PROGRESS_VERSION = 1

export function readProgress(storage) {
  try {
    const state = JSON.parse(storage.getItem(PROGRESS_KEY))
    return state?.version === PROGRESS_VERSION ? state : {}
  } catch {
    return {}
  }
}

export function writeProgress(storage, patch) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...readProgress(storage), ...patch, version: PROGRESS_VERSION }))
    return true
  } catch {
    return false
  }
}

export function snapshotStudy(state) {
  return { lesson: state.lessons[state.index].id, progress: state.progress }
}

export function restoreStudy(curriculum, snapshot) {
  const state = createStudy(curriculum)
  if (!snapshot || typeof snapshot !== 'object') return state
  state.index = Math.max(0,state.lessons.findIndex(lesson => lesson.id === snapshot.lesson))
  for (const lesson of state.lessons) {
    const record = snapshot.progress?.[lesson.id]
    if (!record || typeof record !== 'object') continue
    const answer = (value, question) => Number.isInteger(value) && question.options[value] ? value : null
    const prediction = answer(record.prediction,lesson.predict)
    const confirmed = answer(record.confirmed,lesson.check)
    const edits = {}
    for (const control of lesson.controls ?? []) {
      const value = record.edits?.[control.key]
      if (Number.isFinite(value) && value >= control.min && value <= control.max) edits[control.key] = value
    }
    const tested = record.tested === true && Object.keys(edits).length > 0
    const step = Number.isInteger(record.step) ? Math.max(0,Math.min(record.step,3)) : 0
    state.progress[lesson.id] = { step:prediction === null ? 0 : tested ? step : Math.min(step,1),
      prediction, confirmed, tested, edits, reference:record.reference !== false }
  }
  return state
}

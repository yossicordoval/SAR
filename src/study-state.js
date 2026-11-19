export const STEPS = ['Predict', 'Experiment', 'Explain', 'Check']

export function createStudy(phases) {
  const lessons = phases.flatMap(phase => phase.lessons.map((lesson, index) => ({
    ...lesson, phase: { id: phase.id, title: phase.title, index, count: phase.lessons.length },
  })))
  return { lessons, index: 0, progress: {}, complete: false }
}

const initial = () => ({ step: 0, prediction: null, tested: false, confirmed: null, edits: {}, reference: true })

export function currentLesson(state) {
  const lesson = state.lessons[state.index]
  return { lesson, ...state.progress[lesson.id] || initial() }
}

export function canAdvance(current) {
  switch (current.step) {
    case 0: return current.prediction !== null
    case 1: return current.tested
    case 2: return true
    case 3: return current.confirmed === current.lesson.check.correct
  }
}

export function controlBaseline(lesson, control) {
  const value = control.view ? lesson[control.key] : lesson.baseline[control.key]
  return control.values ? Math.max(0, control.values.indexOf(value)) : value
}

export function studyConfig({ lesson, edits }) {
  const config = { ...lesson.baseline }
  for (const control of lesson.controls) {
    if (!control.view && Object.hasOwn(edits, control.key)) {
      config[control.key] = control.values?.[edits[control.key]] ?? edits[control.key]
    }
  }
  return config
}

export function transition(state, { type, key, value }) {
  const { lesson, ...current } = currentLesson(state)
  const save = next => ({ ...state, progress: { ...state.progress, [lesson.id]: next } })
  if (type === 'repeat') return { ...save(initial()), complete: false }
  if (type === 'back') {
    if (state.complete) return { ...state, complete: false }
    if (current.step > 0) return save({ ...current, step: current.step - 1 })
    if (state.index > 0) return { ...state, index: state.index - 1 }
  }
  if (state.complete) return state
  if (type === 'next' && canAdvance({ lesson, ...current })) {
    if (current.step < STEPS.length - 1) return save({ ...current, step: current.step + 1 })
    if (state.index + 1 < state.lessons.length) return { ...state, index: state.index + 1 }
    return { ...state, complete: true }
  }
  if (type === 'reference') return save({ ...current, reference: Boolean(value) })
  if (type === 'reset' && current.step > 0) {
    return save({ ...initial(), step: 1, prediction: current.prediction, reference: current.reference })
  }
  if (type === 'predict' && current.step === 0 && lesson.predict.options[value]) {
    return save({ ...current, prediction: value })
  }
  if (type === 'confirm' && current.step === 3 && lesson.check.options[value]) {
    return save({ ...current, confirmed: value })
  }
  if (type === 'edit' && current.step === 1) {
    const control = lesson.controls.find(item => item.key === key)
    if (!control || !Number.isFinite(value)) return state
    const snapped = control.min + Math.round((value - control.min) / control.step) * control.step
    const next = Math.max(control.min, Math.min(control.max, snapped))
    if (next === (current.edits[key] ?? controlBaseline(lesson, control))) return state
    return save({ ...current, edits: { ...current.edits, [key]: next }, confirmed: null })
  }
  if (type === 'observed' && current.step === 1 && !current.tested &&
      Object.entries(current.edits).some(([field, edited]) => edited !== controlBaseline(lesson, lesson.controls.find(control => control.key === field)))) {
    return save({ ...current, tested: true })
  }
  return state
}

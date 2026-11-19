import { DURATION, measure, pulseCount, sceneObjects } from './physics.js'

const axes = new WeakMap()

function controlSamples(control, config) {
  if (control.values) return control.values
  if (control.key === 'heading') return Array.from({ length: 73 }, (_, i) => i * 5)
  return [...new Set([control.min, control.max, config[control.key]])]
}

export function comparisonAxes(lesson) {
  if (axes.has(lesson)) return axes.get(lesson)
  const configurations = lesson.controls.filter(control => !control.view).reduce((configs, control) =>
    configs.flatMap(config => controlSamples(control, config).map(value => ({
      ...config, [control.key]: value,
    }))), [lesson.baseline])
  let left = Infinity, right = -Infinity, doppler = 2
  for (const config of configurations) {
    const count = pulseCount(config) - 1
    const time = DURATION * Math.round(lesson.time / DURATION * count) / count
    for (const object of sceneObjects(config)) {
      for (let i = 0; i <= 64; i++) {
        const sample = measure(config, object, i * DURATION / 64)
        doppler = Math.max(doppler, Math.abs(sample.doppler), Math.abs(sample.stationary))
      }
      const times = lesson.controls.some(control => ['time', 'pulses', 'pulseIndex'].includes(control.key))
        ? Array.from({ length: 65 }, (_, i) => i * DURATION / 64) : [time]
      for (const t of times) {
        const { range } = measure(config, object, t)
        left = Math.min(left, range)
        right = Math.max(right, range)
      }
    }
  }
  const margin = lesson.zoom ?? 32
  const result = Object.freeze({ left: left - margin, right: right + margin,
    doppler: Math.ceil(doppler * 1.015 / 3) * 3, magnitude: lesson.magnitude ?? 3.5 })
  axes.set(lesson, result)
  return result
}

export const historyFraction = (pulse, count) => pulse / (count - 1)

export function rangeFraction(range, { left, right }) {
  return (range - left) / (right - left)
}

import { AREA, C, DURATION, platform, pulseTime, sample } from './physics.js'

export function createFocuser(state) {
  const { width, height, config, bins, rangeI, rangeQ, minRange, dr } = state
  const n = width * height
  const xs = Float64Array.from({ length: width }, (_, x) => AREA.x * (2 * (x + 0.5) / width - 1))
  const satY = platform(config, 0).y
  const baseline = Float64Array.from({ length: height }, (_, y) => config.altitude ** 2 +
    (AREA.y * (2 * (y + 0.5) / height - 1) - satY) ** 2)
  const i = new Float32Array(n), q = new Float32Array(n)
  const snapshots = new Map()
  const phaseFactor = 4 * Math.PI * config.frequency * 1e6 / C
  let last = -1, first = 0, weight = 0

  return (end, instant) => {
    const start = instant ? end : 0
    if (start !== first || end < last) {
      const restore = !instant && [...snapshots.keys()].filter(p => p <= end).at(-1)
      if (typeof restore === 'number') {
        const snap = snapshots.get(restore)
        i.set(snap.i)
        q.set(snap.q)
        weight = snap.weight
        last = restore
      } else {
        i.fill(0)
        q.fill(0)
        weight = 0
        last = start - 1
      }
      first = start
    }
    for (let p = last + 1; p <= end; p++) {
      const time = pulseTime(config, p)
      const satX = platform(config, time).x
      const apodization = 0.55 + 0.45 * Math.sin(Math.PI * time / DURATION) ** 2
      weight += apodization
      const offset = p * bins
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = xs[x] - satX
          // A flat, stationary hypothesis for this image pixel across the aperture.
          const range = Math.sqrt(dx * dx + baseline[y])
          const cell = (range - minRange) / dr
          const re = sample(rangeI, offset, cell, bins)
          const im = sample(rangeQ, offset, cell, bins)
          const phase = phaseFactor * range
          const cos = Math.cos(phase) * apodization, sin = Math.sin(phase) * apodization
          const k = y * width + x
          i[k] += re * cos - im * sin
          q[k] += re * sin + im * cos
        }
      }
      if (!instant && p % 12 === 0) snapshots.set(p, { i: i.slice(), q: q.slice(), weight })
    }
    last = end
    return i.map((re, index) => Math.hypot(re, q[index]) / weight)
  }
}

export function migrationShift(config, reference, pulse) {
  const sat = platform(config, pulseTime(config, pulse))
  return Math.hypot(reference.x - sat.x, reference.y - sat.y, reference.z - sat.z) - reference.range
}

export function migration(state, first, end, selected) {
  const { bins, rangeI, rangeQ, tracks, config, dr } = state
  const track = tracks[selected]
  const reference = track[Math.floor(track.length / 2)]
  const data = new Float32Array((end - first + 1) * bins)
  for (let p = first; p <= end; p++) {
    const shift = migrationShift(config, reference, p) / dr
    for (let b = 0; b < bins; b++) {
      data[(p - first) * bins + b] = Math.hypot(sample(rangeI, p * bins, b + shift, bins),
        sample(rangeQ, p * bins, b + shift, bins))
    }
  }
  return data
}

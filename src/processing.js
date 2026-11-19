import { AREA, C, DURATION, platform, pulseTime, sample } from './physics.js'

export function createFocuser(state, { vx = 0, vy = 0, trajectoryDrift = 0 } = {}) {
  const { width, height, config, bins, rangeI, rangeQ, minRange, dr } = state
  const n = width * height
  const xs = Float64Array.from({ length: width }, (_, x) => AREA.x * (2 * (x + 0.5) / width - 1))
  const satY = platform(config, 0).y
  const ys = Float64Array.from({ length: height }, (_, y) => AREA.y * (2 * (y + 0.5) / height - 1) - satY)
  const altitudeSquared = config.altitude ** 2
  const i = new Float32Array(n), q = new Float32Array(n)
  const snapshots = new Map()
  const phaseFactor = 4 * Math.PI * config.frequency * 1e6 / C
  let last = -1, first = 0, weight = 0

  return (end, instant, windowStart = 0) => {
    const start = instant ? end : windowStart
    if (start !== first || end < last) {
      const restore = !instant && start === 0 && [...snapshots.keys()].filter(p => p <= end).at(-1)
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
      const centeredTime = time - DURATION/2
      const satX = platform(config, time).x + trajectoryDrift * centeredTime
      const shiftX = vx * centeredTime
      const shiftY = vy * centeredTime
      const apodization = 0.55 + 0.45 * Math.sin(Math.PI * time / DURATION) ** 2
      weight += apodization
      const offset = p * bins
      for (let y = 0; y < height; y++) {
        const crossRangeSquared = altitudeSquared + (ys[y]+shiftY)**2
        for (let x = 0; x < width; x++) {
          const dx = xs[x] + shiftX - satX
          // All candidate pixels share the selected flat-ground motion hypothesis.
          const range = Math.sqrt(dx * dx + crossRangeSquared)
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
      if (!instant && start === 0 && p % 12 === 0) snapshots.set(p, { i: i.slice(), q: q.slice(), weight })
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

// Measure the connected main lobe along the row crossing the known reflector.
export function alongTrackWidth(image, width, height, groundY) {
  const row = Math.min(height - 1, Math.max(0, Math.floor((groundY + AREA.y) * height / (2 * AREA.y))))
  const values = image.subarray(row * width, (row + 1) * width)
  let peak = 0
  for (let i = 1; i < width; i++) if (values[i] > values[peak]) peak = i
  if (!(values[peak] > 0)) return NaN
  const threshold = values[peak] / Math.SQRT2
  let left = peak, right = peak
  while (left > 0 && values[left] >= threshold) left--
  while (right < width - 1 && values[right] >= threshold) right++
  if (values[left] >= threshold || values[right] >= threshold) return NaN
  const start = left + (threshold-values[left])/(values[left+1]-values[left])
  const end = right - (threshold-values[right])/(values[right-1]-values[right])
  return (end-start) * 2 * AREA.x / width
}

export function imageMetrics(state, image, first, last, selected) {
  const { config, width, height, tracks } = state
  return {
    pulses: last - first + 1,
    aperture: config.speed * (pulseTime(config,last)-pulseTime(config,first)),
    azimuthWidth: alongTrackWidth(image,width,height,tracks[selected][last].y),
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { AREA, C, DEFAULTS, components, createAcquisition, measure, sceneObjects } from '../src/physics.js'
import { createFocuser, migration, migrationShift } from '../src/processing.js'

test('delay, phase and Doppler agree with range and its time derivative, including motion', () => {
  const config = { ...DEFAULTS, targetSpeed: 14 }
  const [vehicle] = sceneObjects(config)
  const dt = 0.0001
  const time = 4.7
  const reading = measure(config, vehicle, time)
  const slope = (measure(config, vehicle, time + dt).range - measure(config, vehicle, time - dt).range) / (2 * dt)
  const lambda = C / (config.frequency * 1e6)
  assert.equal(reading.delay, 2 * reading.range / C)
  assert.equal(reading.phase, -4 * Math.PI * reading.range / lambda)
  assert.ok(Math.abs(reading.doppler + 2 * slope / lambda) < 1e-6)
  assert.notEqual(reading.doppler, reading.stationary)
})

test('default echoes contain scene clutter away from the isolated vehicle echo', () => {
  const full = createAcquisition(DEFAULTS)
  const repeat = createAcquisition(DEFAULTS)
  assert.deepEqual(full.i, repeat.i)
  assert.deepEqual(full.q, repeat.q)
  const pulse = Math.floor(full.count / 2)
  const withGround = components(full, pulse, 'vehicle')
  assert.ok(withGround.ground.some((strength, bin) => strength > 0.12 && withGround.target[bin] === 0))
  const clean = createAcquisition({ ...DEFAULTS, clutter: false, noise: 0 })
  const isolated = components(clean, pulse, 'vehicle')
  assert.ok(isolated.ground.every(strength => strength === 0))
  assert.deepEqual(isolated.echo, isolated.target)
})

test('matched filtering narrows an isolated echo and corrects the stationary range history', () => {
  const config = { ...DEFAULTS, scenario: 'rocks', clutter: false, noise: 0 }
  const state = createAcquisition(config)
  const pulse = Math.floor(state.count / 2)
  const mainLobe = (i, q, center, row) => {
    const offset = row * state.bins
    const levels = Array.from({ length: 23 }, (_, j) => Math.hypot(i[offset + center - 11 + j], q[offset + center - 11 + j]))
    return levels.filter(level => level > Math.max(...levels) / Math.sqrt(2)).length
  }
  const track = state.tracks.rock2
  const center = Math.round((track[pulse].range - state.minRange) / state.dr)
  assert.ok(mainLobe(state.rangeI, state.rangeQ, center, pulse) < mainLobe(state.i, state.q, center, pulse))
  const shifted = migration(state, 0, state.count - 1, 'rock2')
  assert.equal(shifted.length, state.count * state.bins)
  assert.ok(migrationShift(config, track[pulse], 0) > 30)
  for (const index of [0, pulse, state.count - 1]) {
    const corrected = track[index].range - migrationShift(config, track[pulse], index)
    assert.ok(Math.abs(corrected - track[pulse].range) < 1e-10)
    const nearReference = shifted.slice(index * state.bins + center - 2, index * state.bins + center + 3)
    assert.ok(nearReference[2] > 0.04)
    assert.equal(nearReference[2], Math.max(...nearReference))
  }
})

test('backprojection peaks near the survey vehicle and reconstructs the same prefix after rewind', () => {
  const state = createAcquisition({ ...DEFAULTS, clutter: false, noise: 0 })
  const focus = createFocuser(state)
  const middle = Math.floor(state.count / 2)
  const early = focus(middle, false)
  const single = focus(middle, true)
  assert.notDeepEqual(single, early)
  const fullImage = focus(state.count - 1, false)
  const peak = fullImage.indexOf(Math.max(...fullImage))
  const peakX = AREA.x * (2 * ((peak % state.width) + 0.5) / state.width - 1)
  const peakY = AREA.y * (2 * (Math.floor(peak / state.width) + 0.5) / state.height - 1)
  assert.ok(Math.hypot(peakX - DEFAULTS.targetX, peakY - DEFAULTS.targetY) < 14)
  assert.deepEqual(focus(middle, false), early)
  focus(0, false)
  assert.deepEqual(focus(middle, false), early)
})

test('quality changes sampling without changing the simulated position or chirp slope', () => {
  const lower = createAcquisition(DEFAULTS)
  const higher = createAcquisition({ ...DEFAULTS, quality: 'medium' })
  assert.deepEqual(higher.tracks, lower.tracks)
  assert.equal(higher.wave.slope, lower.wave.slope)
  assert.ok(higher.dr < lower.dr)
  assert.ok(higher.width > lower.width)
})

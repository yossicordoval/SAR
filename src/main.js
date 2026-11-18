import './style.css'
import { DEFAULTS, DURATION, SCENARIOS, pulseCount, sceneObjects } from './physics.js'
import { plotImage, plotMatrix, plotProfile } from './plots.js'
import { createScene } from './scene.js'
import { icon, renderLayout } from './ui.js'
import { renderStudy } from './study.js'

renderLayout(document.querySelector('#app'))
const $ = id => document.getElementById(id)
const all = selector => Array.from(document.querySelectorAll(selector))
const options = Object.fromEntries(all('[data-option]').map(el => [el.dataset.option,el.checked]))
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
const view = { mode: 'sandbox', answer: null, tab: 'range', stage: 'focused', instant: false, selected: 'vehicle',
  playing: false, rate: 1, pulse: Math.round((pulseCount(DEFAULTS) - 1) * 0.61), maximum: null }
let config = { ...DEFAULTS }, sandboxConfig, frame, acquisition, revision = 1, activeRevision = 0
let request = 0, sent = 0, scheduled = false, pending = false, startTime = 0, startPulse = 0
const optical = createScene($('optical'),false,selectObject)
const geometry = createScene($('geometry'),true,selectObject)
const stages = {
  focused: 'Coherent backprojection', raw: 'Unfocused complex echoes',
  range: 'Chirp matched filter', migration: 'Stationary reference alignment',
}

function status(message, state = '') {
  $('engine-status').textContent = message
  $('engine-status').parentElement.dataset.state = state
}

function fillRange(element) {
  element.style.setProperty('--fill', ((+element.value - +element.min) / (+element.max - +element.min) * 100) + '%')
}
function updateControls() {
  all('.slider-label input').forEach(element => {
    element.value = config[element.id]
    const unit = element.dataset.unit
    const visible = element.id === 'noise' ? Number(element.value).toFixed(3) : element.value
    $(element.id + '-out').textContent = visible + (unit === '°' || unit === '×' ? '' : ' ') + unit
    fillRange(element)
  })
  $('frequency').value = config.frequency
  $('quality').value = config.quality
  $('clutter').checked = config.clutter
  all('[data-scenario]').forEach(el => el.setAttribute('aria-pressed',el.dataset.scenario === config.scenario))
}

function requestFrame() {
  request++
  if (scheduled || pending) return
  scheduled = true
  requestAnimationFrame(send)
}
function send() {
  scheduled = false
  if (pending) return
  pending = true
  const newAcquisition = activeRevision !== revision
  if (newAcquisition) status('COMPUTING','busy')
  sent = request
  worker.postMessage({ revision, request: sent, config: newAcquisition ? config : null, pulse: view.pulse,
    instant: view.instant, stage: view.stage, selected: view.selected })
  activeRevision = revision
}

worker.onmessage = ({ data }) => {
  if (data.type === 'acquisition') {
    acquisition = data
    return
  }
  pending = false
  // Commit a complete snapshot only after the worker has finished every view.
  if (data.revision === revision && data.request === request) {
    frame = { ...data, acquisition, tracks: acquisition.tracks, config: { ...config } }
    status('ENGINE READY')
    draw()
    if (view.playing && view.pulse === acquisition.count - 1) setPlaying(false)
  }
  if (request !== sent && !scheduled) {
    scheduled = true
    requestAnimationFrame(send)
  }
}
worker.onerror = event => {
  pending = false
  setPlaying(false)
  status('ENGINE ERROR','error')
  console.error(event.message || 'The simulation worker stopped.')
}

function drawPlots() {
  plotProfile($('profile'),frame,view.tab,$('contributions').checked)
  plotMatrix($('raw'),frame)
  if (frame?.stage === 'focused') plotImage($('image'),frame,selectObject,options.labels)
  else if (frame) {
    $('image').onclick = null
    plotMatrix($('image'),frame,frame.stage,true)
  }
}
function draw() {
  if (!frame) return
  const { time, pulse, first, selected, tracks } = frame
  const a = frame.acquisition
  const track = tracks[selected][pulse]
  const label = sceneObjects(frame.config).find(obj => obj.id === selected).label
  $('optical-object').textContent = label
  $('scenario-tag').textContent = SCENARIOS.find(s => s.id === frame.config.scenario).name
  $('obs-range').textContent = track.range.toFixed(1) + ' m'
  $('obs-doppler').textContent = (track.doppler >= 0 ? '+' : '−') + Math.abs(track.doppler).toFixed(2) + ' Hz'
  $('obs-delay').textContent = (track.delay * 1e6).toFixed(2) + ' μs'
  const phase = Math.atan2(Math.sin(track.phase),Math.cos(track.phase))
  $('obs-phase').textContent = (phase * 180 / Math.PI).toFixed(0) + '°'
  $('signal-count').textContent = (pulse - first + 1) + (pulse === first ? ' pulse' : ' pulses') + ' acquired'
  $('image-key').textContent = stages[frame.stage]
  $('image-size').textContent = frame.stage === 'focused'
    ? a.width + ' × ' + a.height + ' pixels'
    : a.bins + ' range bins'
  $('clock').textContent = time.toFixed(2) + ' / ' + DURATION.toFixed(2) + ' s'
  $('scrub').max = a.count - 1
  $('scrub').value = pulse
  fillRange($('scrub'))
  $('monitors').dataset.pulse = pulse
  $('monitors').dataset.acquired = pulse - first + 1
  $('monitors').dataset.revision = frame.revision
  optical.render(frame,frame.config,options)
  geometry.render(frame,frame.config,options)
  drawPlots()
  updateSignalKey()
}

function updateSignalKey() {
  const contributions = $('contributions').checked
  const moving = frame?.tracks[frame.selected].some(v => Math.abs(v.doppler-v.stationary)>0.001)
  $('signal-ground').hidden = view.tab !== 'range' || !contributions
  $('signal-key').textContent = { range: 'Total return',
    iq: 'In-phase', doppler: 'Selected Doppler' }[view.tab]
  $('signal-extra').hidden = !(view.tab === 'iq' || (view.tab === 'range' && contributions) || (view.tab === 'doppler' && moving))
  $('signal-extra-label').textContent = { range: 'Selected echo', iq: 'Quadrature', doppler: 'Stationary prediction' }[view.tab]
}

function selectObject(id) {
  if (view.selected === id || !sceneObjects(config).some(obj => obj.id === id)) return
  view.selected = id
  requestFrame()
}
function setPulse(pulse) {
  view.pulse = Math.max(0,Math.min(pulseCount(config)-1,Math.round(pulse)))
  requestFrame()
}
function editConfig(update, redrawControls = true) {
  const oldCount = pulseCount(config)
  const fraction = view.pulse / (oldCount - 1)
  config = { ...config, ...update }
  if (!sceneObjects(config).some(obj => obj.id === view.selected)) view.selected = 'vehicle'
  view.pulse = Math.round(fraction * (pulseCount(config) - 1))
  if (view.playing) anchorPlayback()
  if (redrawControls) updateControls()
  revision++
  requestFrame()
}

function anchorPlayback() {
  startTime = performance.now()
  startPulse = view.pulse
}
function setPlaying(playing) {
  if (playing && view.instant) setInstant(false)
  if (playing && view.pulse >= pulseCount(config)-1) setPulse(0)
  const wasPlaying = view.playing
  view.playing = playing
  if (playing) anchorPlayback()
  else if (wasPlaying && frame?.revision === revision && view.pulse !== frame.pulse) setPulse(frame.pulse)
  $('play').innerHTML = icon(playing ? 'pause' : 'play',19)
  $('play').setAttribute('aria-label',playing ? 'Pause' : 'Play')
  $('play').title = (playing ? 'Pause' : 'Play') + ' (Space)'
  if (!($('study-card').contains(document.activeElement) && document.activeElement.dataset.answer !== undefined))
    refreshStudy()
  else updateReplay()
}
function updateReplay() {
  if ($('study-replay')) $('study-replay').innerHTML = icon(view.playing ? 'pause' : 'play') + ' ' +
    (view.playing ? 'Pause demonstration' : 'Replay demonstration')
}
function setInstant(instant) {
  view.instant = instant
  $('flight').setAttribute('aria-pressed',!instant)
  $('instant').setAttribute('aria-pressed',instant)
  if (instant) setPlaying(false)
  requestFrame()
}
function selectTab(tab) {
  view.tab = tab
  all('[data-tab]').forEach(el => el.setAttribute('aria-pressed',el.dataset.tab === tab))
  drawPlots()
  updateSignalKey()
}

setInterval(() => {
  if (!view.playing || pending || scheduled) return
  const elapsed = (performance.now() - startTime) / 1000
  const target = startPulse + elapsed * config.prf * view.rate
  const next = Math.min(pulseCount(config)-1,Math.floor(target))
  if (next !== view.pulse) setPulse(next)
}, 100)

function refreshStudy() {
  if (view.mode === 'study') renderStudy($('study-card'),view.answer,view.playing)
}
function setMode(mode) {
  if (view.mode === mode) return
  setPlaying(false)
  view.mode = mode
  $('study-mode').setAttribute('aria-pressed',mode === 'study')
  $('sandbox-mode').setAttribute('aria-pressed',mode === 'sandbox')
  $('study-card').hidden = mode !== 'study'
  $('radar-card').hidden = mode === 'study'
  $('scenarios-card').hidden = mode === 'study'
  if (mode === 'study') {
    sandboxConfig = config
    view.answer = null
    view.selected = 'vehicle'
    view.stage = 'focused'
    $('stage').value = view.stage
    selectTab('range')
    $('contributions').checked = false
    setInstant(false)
    editConfig(DEFAULTS)
    setPulse(0)
    refreshStudy()
  } else {
    editConfig(sandboxConfig || DEFAULTS)
  }
}

$('sandbox-mode').onclick = () => setMode('sandbox')
$('study-mode').onclick = () => setMode('study')
$('study-card').onclick = e => {
  const answer = e.target.closest('[data-answer]')
  if (answer) {
    view.answer = Number(answer.dataset.answer)
    $('contributions').checked = true
    selectTab('range')
    setPulse(0)
    refreshStudy()
    $('study-card').querySelector('[data-answer="' + view.answer + '"]').focus()
    setPlaying(true)
  } else if (e.target.closest('#study-replay')) {
    if (!view.playing) setPulse(0)
    setPlaying(!view.playing)
    $('study-replay')?.focus()
  }
}
all('[data-scenario]').forEach(el => el.onclick = () => {
  const scenario = el.dataset.scenario
  view.selected = 'vehicle'
  editConfig({ scenario, targetX: DEFAULTS.targetX, targetY: DEFAULTS.targetY,
    targetSpeed: scenario === 'moving' ? 15 : 0, heading: DEFAULTS.heading, rcs: DEFAULTS.rcs })
})
all('.slider-label input').forEach(el => el.oninput = () => editConfig({ [el.id]: Number(el.value) }))
$('frequency').onchange = e => editConfig({ frequency: +e.target.value })
$('quality').onchange = e => editConfig({ quality: e.target.value })
$('clutter').onchange = e => editConfig({ clutter: e.target.checked })
all('[data-option]').forEach(el => el.onchange = () => { options[el.dataset.option] = el.checked; draw() })
all('[data-tab]').forEach(el => el.onclick = () => selectTab(el.dataset.tab))
$('contributions').onchange = () => { drawPlots(); updateSignalKey() }
$('stage').onchange = e => { view.stage = e.target.value; requestFrame() }
$('reset-optical').onclick = optical.reset
$('reset-geometry').onclick = geometry.reset
$('play').onclick = () => setPlaying(!view.playing)
$('reset').onclick = () => { setPlaying(false); setPulse(0) }
$('step').onclick = () => { setPlaying(false); setPulse(view.pulse + 1) }
$('scrub').oninput = e => { setPlaying(false); fillRange(e.target); setPulse(+e.target.value) }
$('flight').onclick = () => setInstant(false)
$('instant').onclick = () => setInstant(true)
$('rate').onchange = e => { view.rate = +e.target.value; anchorPlayback() }
$('help').onclick = () => $('about').showModal()
$('close-help').onclick = () => $('about').close()

function maximize(id) {
  view.maximum = view.maximum === id ? null : id
  const dashboard = $('monitors')
  if (view.maximum) dashboard.dataset.maximum = view.maximum
  else delete dashboard.dataset.maximum
  all('.maximize').forEach(button => {
    const active = view.maximum === button.dataset.panel
    const title = $('title-' + button.dataset.panel).textContent
    button.innerHTML = icon(active ? 'shrink' : 'expand')
    button.setAttribute('aria-label',(active ? 'Restore ' : 'Maximize ') + title)
    button.title = button.getAttribute('aria-label')
  })
}
all('.maximize').forEach(el => el.onclick = () => maximize(el.dataset.panel))
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && view.maximum && !$('about').open) maximize(view.maximum)
  if (e.code === 'Space' && !e.repeat && e.target === document.body && !$('about').open) {
    e.preventDefault()
    setPlaying(!view.playing)
  }
})

const monitor = $('monitors')
const splits = { top: 45, bottom: 48.5, rows: 49 }
try {
  const saved = JSON.parse(localStorage.getItem('sar-layout'))
  for (const key of Object.keys(splits)) {
    if (Number.isFinite(saved?.[key])) splits[key] = Math.max(27,Math.min(73,saved[key]))
  }
} catch { /* The default layout is available without storage. */ }
function applySplit(key, value) {
  splits[key] = Math.max(27,Math.min(73,value))
  monitor.style.setProperty('--' + key,splits[key] + '%')
  monitor.querySelector('[data-split="' + key + '"]').setAttribute('aria-valuenow',Math.round(splits[key]))
}
function storeSplits() {
  try { localStorage.setItem('sar-layout',JSON.stringify(splits)) } catch { /* Layout still works in memory. */ }
}
all('[data-split]').forEach(el => {
  const key = el.dataset.split
  const horizontal = key === 'rows'
  applySplit(key,splits[key])
  el.setAttribute('aria-valuemin','27')
  el.setAttribute('aria-valuemax','73')
  el.onpointerdown = e => el.setPointerCapture(e.pointerId)
  el.onpointermove = e => {
    if (!el.hasPointerCapture(e.pointerId)) return
    const box = el.parentElement.getBoundingClientRect()
    applySplit(key,100 * (horizontal ? (e.clientY-box.top)/box.height : (e.clientX-box.left)/box.width))
  }
  el.onlostpointercapture = storeSplits
  el.onkeydown = e => {
    const decrement = horizontal ? 'ArrowUp' : 'ArrowLeft'
    const increment = horizontal ? 'ArrowDown' : 'ArrowRight'
    if (![decrement,increment].includes(e.key)) return
    e.preventDefault()
    applySplit(key,splits[key] + (e.key === decrement ? -2 : 2))
    storeSplits()
  }
})

let redrawQueued = false
const resize = new ResizeObserver(() => {
  if (redrawQueued) return
  redrawQueued = true
  requestAnimationFrame(() => {
    redrawQueued = false
    optical.draw()
    geometry.draw()
    drawPlots()
  })
})
all('.panel').forEach(panel => resize.observe(panel))
updateControls()
requestFrame()

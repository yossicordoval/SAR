import { PROGRESS_KEY, readProgress, restoreStudy, snapshotStudy, writeProgress } from './learning-progress.js'
import './style.css'
import { createSpace } from './space.js'
import { installLearningInfo } from './learning-info.js'
import { DEFAULTS, DURATION, SCENARIOS, pulseCount, sceneObjects } from './physics.js'
import { plotImage, plotMatrix, plotProfile } from './plots.js'
import { createScene } from './scene.js'
import { icon, renderLayout } from './ui.js'
import { renderStudy, updateStudyMeasurements, updateStudyNavigation } from './study.js'
import { mountVisualization } from './study-visual.js'
import { studyScene } from './curriculum-expanded.js'
import { curriculum } from './curriculum.js'
import { createStudy, currentLesson, studyConfig, transition } from './study-state.js'

renderLayout(document.querySelector('#app'))
const $ = id => document.getElementById(id)
installLearningInfo($('learning-info'))
const all = selector => Array.from(document.querySelectorAll(selector))
const options = Object.fromEntries(all('[data-option]').map(el => [el.dataset.option,el.checked]))
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
const view = { mode: 'sandbox', tab: 'range', stage: 'focused', instant: false, selected: 'vehicle',
  playing: false, rate: 1, pulse: Math.round((pulseCount(DEFAULTS) - 1) * 0.61), maximum: null }
let config = { ...DEFAULTS }, sandbox, frame, acquisition, revision = 1, activeRevision = 0
const storage = (() => {
  try { return window.localStorage } catch { return undefined }
})()
const progress = readProgress(storage)
let study = restoreStudy(curriculum,progress.ground), updateVisualization
let lastStudy = progress.lastStudy ?? '0A-1', lastAnalysis = progress.lastAnalysis ?? '2-1'
let resumeMode = ['study','analysis','space'].includes(progress.resumeMode) ? progress.resumeMode : null
const studyCard = $('study-card')
const isGuided = () => view.mode === 'study' || view.mode === 'analysis'
const space = createSpace($('space-card'),$('space-intro'),progress.orbital,orbital => {
  writeProgress(storage,{orbital})
})
const studyContext = () => isGuided() ? currentLesson(study) : null
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
  all('#radar-card .slider-label input').forEach(element => {
    element.value = config[element.id]
    const unit = element.dataset.unit
    const visible = element.id === 'noise' ? Number(element.value).toFixed(3) : element.value
    $(element.id + '-out').textContent = visible + (unit === '°' || unit === '×' ? '' : ' ') + unit
    fillRange(element)
  })
  $('frequency').value = config.frequency
  $('quality').value = config.quality
  $('clutter').checked = config.clutter
  $('terrain-options').hidden = config.scenario !== 'terrain'
  $('ground-focus').hidden = view.mode !== 'sandbox' || !['urban','terrain'].includes(config.scenario)
  for (const [id,key] of [['terrain-type','terrain'],['terrain-height','terrainHeight'],['terrain-direction','terrainDirection'],['terrain-steepness','terrainSteepness'],['terrain-look-side','lookSide']]) {
    $(id).value = config[key] ?? 1
  }
  $('urban-options').hidden = config.scenario !== 'urban'
  $('urban-density').value = config.urbanDensity
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
  if (view.mode === 'space') { pending = false; return }
  if (newAcquisition) status('COMPUTING','busy')
  sent = request
  const lesson = studyContext()?.lesson
  const comparison = lesson && { id: lesson.id, baseline: lesson.baseline, profile: lesson.profile, time: lesson.time,
    visualBandwidth: lesson.visual.startsWith('bandwidth') ? 72 : undefined,
    compareImage: lesson.compareImage, apertureMetrics: lesson.id === '3', motionExample: lesson.visual === 'doppler',
    instant: lesson.instant }
  worker.postMessage({ revision, request: sent, config: newAcquisition ? config : null, pulse: view.pulse,
    instant: view.instant, first: view.windowStart, focusModel:view.focusModel, trajectoryDrift:view.trajectoryDrift, source:view.studySource, stage: view.stage, selected: view.selected, study: comparison })
  activeRevision = revision
}

worker.onmessage = ({ data }) => {
  if (data.type === 'acquisition') {
    acquisition = data
    return
  }
  pending = false
  if (view.mode === 'space') return
  // Commit a complete snapshot only after the worker has finished every view.
  if (data.revision === revision && data.request === request) {
    frame = { ...data, acquisition, tracks: acquisition.tracks, config: { ...config } }
    status('ENGINE READY')
    draw()
    const lesson = studyContext()?.lesson
    if (lesson && frame.studyId === lesson.id) {
      const next = transition(study, { type: 'observed' })
      if (next !== study) {
        study = next
        saveGroundProgress()
      }
      updateStudyMeasurements(studyCard, lesson, frame)
      updateVisualization?.(frame)
      updateStudyNavigation(studyCard, currentLesson(study))
    }
    if (view.playing && view.pulse === acquisition.count - 1) setPlaying(false)
  }
  if (request !== sent && !scheduled) {
    scheduled = true
    requestAnimationFrame(send)
  }
}
worker.onerror = event => {
  pending = false
  if (view.mode === 'space') return
  setPlaying(false)
  status('ENGINE ERROR','error')
  console.error(event.message || 'The simulation worker stopped.')
}

function drawPlots() {
  const context = studyContext()
  if ((context?.lesson.id || undefined) !== frame?.studyId) return
  plotProfile($('profile'),frame,view.tab,$('contributions').checked,context)
  plotMatrix($('raw'),frame)
  if (frame?.stage === 'focused') plotImage($('image'),frame,selectObject,options.labels && !blindEvidence())
  else if (frame) {
    $('image').onclick = null
    plotMatrix($('image'),frame,frame.stage,true)
  }
}
function blindEvidence() {
  const current = studyContext()
  return current?.lesson.evidence && current.step < 2
}
function draw() {
  if (view.mode === 'space') return space.draw()
  if (!frame) return
  const { time, pulse, first, selected, tracks } = frame
  const a = frame.acquisition
  const track = tracks[selected][pulse]
  const label = sceneObjects(frame.config).find(obj => obj.id === selected).label
  $('optical-object').textContent = label
  const lesson = studyContext()?.lesson
  $('scenario-tag').textContent = lesson?.sceneLabel || SCENARIOS.find(s => s.id === frame.config.scenario).name
  $('obs-range').textContent = track.range.toFixed(1) + ' m'
  $('obs-doppler').textContent = (track.doppler >= 0 ? '+' : '−') + Math.abs(track.doppler).toFixed(2) + ' Hz'
  $('obs-delay').textContent = (track.delay * 1e6).toFixed(2) + ' μs'
  const phase = Math.atan2(Math.sin(track.phase),Math.cos(track.phase))
  $('obs-phase').textContent = (phase * 180 / Math.PI).toFixed(0) + '°'
  $('signal-count').textContent = (pulse - first + 1) + (pulse === first ? ' pulse' : ' pulses') + ' acquired'
  $('image-key').textContent = frame.stage !== 'focused' ? stages[frame.stage] :
    ({elevation:'Elevation-aware backprojection',geocoded:'Flat image geocoded at mid-pass',flat:'Flat-ground backprojection'}[frame.focusModel] ?? stages.focused)
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
  const visibility = lesson ? { ...options, labels:true,los:true,range:true,dem:frame.config.scenario==='terrain' } : options
  optical.render(frame,frame.config,visibility)
  geometry.render(frame,frame.config,visibility)
  drawPlots()
  updateSignalKey()
}

function updateSignalKey() {
  const contributions = $('contributions').checked
  const moving = frame?.tracks[frame.selected].some(v => Math.abs(v.doppler-v.stationary)>0.001)
  $('signal-ground').hidden = view.tab !== 'range' || !contributions
  $('signal-key').textContent = { range: studyContext()?.lesson.profile === 'compressed' ? 'Compressed magnitude' : 'Total return',
    iq: 'In-phase', doppler: 'Selected Doppler' }[view.tab]
  $('signal-extra').hidden = !(view.tab === 'iq' || (view.tab === 'range' && contributions) || (view.tab === 'doppler' && moving))
  $('signal-extra-label').textContent = { range: 'Selected echo', iq: 'Quadrature', doppler: 'Stationary prediction' }[view.tab]
}

function selectObject(id) {
  if (view.selected === id || !sceneObjects(config).some(obj => obj.id === id)) return
  view.selected = id
  updateStudyTarget()
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
  if (!sceneObjects(config).some(obj => obj.id === view.selected)) view.selected = sceneObjects(config)[0].id
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
  if (playing && view.mode !== 'sandbox') return
  if (playing && view.instant) setInstant(false)
  if (playing && view.pulse >= pulseCount(config)-1) setPulse(0)
  const wasPlaying = view.playing
  view.playing = playing
  if (playing) anchorPlayback()
  else if (wasPlaying && frame?.revision === revision && view.pulse !== frame.pulse) setPulse(frame.pulse)
  $('play').innerHTML = icon(playing ? 'pause' : 'play',19)
  $('play').setAttribute('aria-label',playing ? 'Pause' : 'Play')
  $('play').title = (playing ? 'Pause' : 'Play') + ' (Space)'
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

function updateStudyTarget() {
  studyCard.querySelectorAll('[data-study-target]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.studyTarget === view.selected)
  })
}

function saveGroundProgress() {
  if (view.mode === 'study') lastStudy = currentLesson(study).lesson.id
  if (view.mode === 'analysis') lastAnalysis = currentLesson(study).lesson.id
  writeProgress(storage,{ground:snapshotStudy(study),lastStudy,lastAnalysis,resumeMode})
}

function showResume() {
  $('resume-learning').hidden = view.mode !== 'sandbox' || !resumeMode
}

function showStudy(focusHeading = false, resetSelection = false) {
  saveGroundProgress()
  const current = currentLesson(study)
  const { lesson } = current
  $('app').classList.toggle('evidence',Boolean(blindEvidence()))
  $('ground-focus').hidden = true
  const sameLesson = $('monitors').dataset.lesson === lesson.id
  if (view.maximum && !sameLesson) maximize(view.maximum)
  $('monitors').dataset.lesson = lesson.id
  all('.panel').forEach(panel => panel.classList.toggle('study-highlight',lesson.panels.includes(panel.id.slice(6))))
  renderStudy(studyCard,study)
  updateVisualization = mountVisualization(studyCard,lesson,time => {
    const control = studyCard.querySelector('[data-study-control="pulseIndex"]')
    if (!control) return
    control.value = Math.round(time / DURATION * (pulseCount(config)-1))
    control.dispatchEvent(new Event('input',{ bubbles: true }))
  })
  if (!sameLesson || resetSelection) view.studySource = 'off'
  if (!sameLesson || resetSelection) view.selected = lesson.focus ?? sceneObjects(lesson.baseline)[0].id
  updateStudyTarget()
  view.stage = lesson.stage
  $('stage').value = lesson.stage
  selectTab(lesson.tab)
  setInstant(lesson.instant)
  applyStudyExperiment(current)
  updateStudyNavigation(studyCard,current,true)
  if (focusHeading) $('study-heading').focus({ preventScroll: true })
}

function applyStudyExperiment(current) {
  const { lesson, step } = current
  const edits = step ? current.edits : {}
  const experiment = edits.sceneMix === undefined ? studyConfig({ lesson, edits }) : studyScene(edits.sceneMix)
  if (Object.entries(experiment).some(([key, value]) => config[key] !== value)) editConfig(experiment)
  const stage = lesson.controls.find(control => control.key === 'stage')
  const focusControl = lesson.controls.find(control => control.key === 'focusModel')
  view.focusModel = focusControl?.values[edits.focusModel] ?? lesson.focusModel
  const sourceControl = lesson.controls.find(control=>control.key==='studySource')
  if (sourceControl) view.studySource = sourceControl.values[edits.studySource] ?? 'off'
  const sourcePicker=studyCard.querySelector('[data-source-overlay]')
  if(sourcePicker) sourcePicker.value=view.studySource ?? 'off'
  view.trajectoryDrift = edits.trajectoryDrift
  view.stage = stage?.values[edits.stage] ?? lesson.stage
  $('stage').value = view.stage
  const aperture = lesson.controls.find(control => control.key === 'pulses')
  const count = pulseCount(config)
  const pulseWindow = aperture?.values[edits.pulses] ?? 1
  view.windowStart = aperture ? Math.floor((count-pulseWindow)/2) : undefined
  setPulse(aperture ? view.windowStart+pulseWindow-1
    : edits.pulseIndex ?? Math.round((edits.time ?? lesson.time) / DURATION * (count - 1)))
  $('timeline-label').textContent = lesson.controls.some(control => ['time','pulses','pulseIndex'].includes(control.key))
    ? 'STUDY FLIGHT POSITION' : 'FIXED EXPERIMENT POSITION'
}

function setSpaceLabels(enabled) {
  const names = enabled ? ['Orbital / Earth View','Spaceborne Radar Geometry','Orbital SAR Data','Spaceborne SAR Image / Coverage']
    : ['Optical View','Radar Geometry','Received Signal','SAR Image']
  ;['optical','geometry','signal','image'].forEach((id,i) => { $('title-'+id).textContent = names[i] })
  $('orbital-transport').hidden = !enabled
  $('orbital-signal').hidden = !enabled
  $('orbital-product').hidden = !enabled
  if (enabled) {
    $('image').onclick = null
    if (view.maximum) maximize(view.maximum)
  }
}

function setMode(mode) {
  if (view.mode === mode) return
  const prior = view.mode
  setPlaying(false)
  if (prior === 'sandbox') {
    sandbox = { config, tab: view.tab, stage: view.stage, instant: view.instant, pulse: view.pulse,
      selected:view.selected, contributions:$('contributions').checked, focusModel:view.focusModel }
  } else if (prior === 'space') space.leave()
  else if (prior === 'study') lastStudy = currentLesson(study).lesson.id
  else lastAnalysis = currentLesson(study).lesson.id
  view.mode = mode
  if (mode !== 'sandbox') {
    resumeMode = mode
    writeProgress(storage,{resumeMode})
  }
  showResume()
  const studying = isGuided(), orbital = mode === 'space'
  const app = $('app')
  app.classList.toggle('studying',studying || orbital)
  app.classList.toggle('space-mode',orbital)
  app.classList.remove('evidence')
  for (const name of ['study','sandbox','analysis','space']) $(name+'-mode').setAttribute('aria-pressed',name===mode)
  studyCard.hidden = !studying
  $('space-card').hidden = !orbital
  $('radar-card').hidden = mode !== 'sandbox'
  $('scenarios-card').hidden = mode !== 'sandbox'
  document.querySelector('.view-card').hidden = mode !== 'sandbox'
  all('[data-tab], #stage, #contributions, .transport > :not(.orbital-transport) button, .transport > :not(.orbital-transport) input, .transport > :not(.orbital-transport) select')
    .forEach(control => { control.disabled = mode !== 'sandbox' })
  setSpaceLabels(orbital)
  if (orbital) {
    request++
    status('ORBITAL LAB')
    $('timeline-label').textContent = 'ORBITAL OBSERVATION'
    space.enter()
  } else if (studying) {
    $('contributions').checked = false
    study = transition(study,{type:'select',value:mode==='analysis'?lastAnalysis:lastStudy})
    showStudy()
  } else {
    view.windowStart = view.trajectoryDrift = view.studySource = undefined
    view.focusModel = sandbox.focusModel
    $('ground-focus').value = view.focusModel ?? 'flat'
    delete $('monitors').dataset.lesson
    all('.study-highlight').forEach(panel => panel.classList.remove('study-highlight'))
    $('timeline-label').textContent = 'FLIGHT TIMELINE'
    view.stage = sandbox.stage
    $('stage').value = sandbox.stage
    $('contributions').checked = sandbox.contributions
    selectTab(sandbox.tab)
    setInstant(sandbox.instant)
    editConfig(sandbox.config)
    view.selected = sandbox.selected
    setPulse(sandbox.pulse)
  }
}

for (const mode of ['sandbox','study','analysis','space']) $(mode+'-mode').onclick = () => setMode(mode)
studyCard.onclick = e => {
  const destination = e.target.closest('[data-lesson-id]')
  if (destination) {
    studyCard.querySelector('dialog').close()
    study = transition(study, { type: 'select', value: destination.dataset.lessonId })
    showStudy(true)
    return
  }
  const button = e.target.closest('button[data-study-action]')
  const target = e.target.closest('button[data-study-target]')
  if (target) selectObject(target.dataset.studyTarget)
  if (!button || button.disabled || !isGuided()) return
  if (button.dataset.studyAction === 'choose') {
    studyCard.querySelector('dialog').showModal()
    return
  }
  const next = transition(study, { type: button.dataset.studyAction })
  if (next === study) return
  study = next
  showStudy(true, ['reset', 'repeat'].includes(button.dataset.studyAction))
}
studyCard.onchange = e => {
  if (e.target.matches('[data-source-overlay]')) {
    view.studySource = e.target.value
    requestFrame()
    return
  }
  const action = e.target.dataset.studyAction
  if (!action || !isGuided()) return
  study = transition(study, { type: action, value: action === 'reference' ? e.target.checked : Number(e.target.value) })
  saveGroundProgress()
  updateStudyNavigation(studyCard,currentLesson(study),frame?.revision !== revision)
  if (action === 'reference') drawPlots()
}
studyCard.oninput = e => {
  const key = e.target.dataset.studyControl
  if (!key || !isGuided()) return
  const next = transition(study, { type: 'edit', key, value: Number(e.target.value) })
  if (next === study) return
  study = next
  saveGroundProgress()
  applyStudyExperiment(currentLesson(study))
  if (e.target.type === 'range') {
    $('study-value-' + key).textContent = e.target.value + (e.target.dataset.unit ? ' ' + e.target.dataset.unit : '')
    fillRange(e.target)
  }
  updateStudyNavigation(studyCard,currentLesson(study),true)
}
function sandboxOnly(action) {
  return event => { if (view.mode === 'sandbox') action(event) }
}
all('[data-scenario]').forEach(el => el.onclick = sandboxOnly(() => {
  const scenario = el.dataset.scenario
  view.selected = sceneObjects({...config,scenario})[0].id
  view.focusModel = undefined
  $('ground-focus').value = 'flat'
  editConfig({ scenario, targetX: DEFAULTS.targetX, targetY: DEFAULTS.targetY,
    targetSpeed: scenario === 'moving' ? 15 : 0, heading: DEFAULTS.heading, rcs: DEFAULTS.rcs })
}))
all('.slider-label input').forEach(el => el.oninput = sandboxOnly(() => editConfig({ [el.id]: Number(el.value) })))
$('frequency').onchange = sandboxOnly(e => editConfig({ frequency: +e.target.value }))
$('quality').onchange = sandboxOnly(e => editConfig({ quality: e.target.value }))
$('clutter').onchange = sandboxOnly(e => editConfig({ clutter: e.target.checked }))
for (const [id,key,numeric] of [['terrain-type','terrain',false],['terrain-height','terrainHeight',true],['terrain-direction','terrainDirection',true],['terrain-steepness','terrainSteepness',true],['terrain-look-side','lookSide',true]]) {
  $(id).oninput = sandboxOnly(e=>editConfig({[key]:numeric ? +e.target.value : e.target.value},false))
}
$('terrain-dem').onchange = sandboxOnly(e=>{ options.dem = e.target.checked; draw() })
$('ground-focus').onchange = sandboxOnly(e=>{ view.focusModel = e.target.value; requestFrame() })
$('urban-density').onchange = sandboxOnly(e => editConfig({ urbanDensity:e.target.value }))
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
$('resume-learning').onclick = () => { if (resumeMode) setMode(resumeMode) }
$('reset-learning').onclick = () => {
  if (!confirm('Reset all saved SARcade lesson progress?')) return
  if (view.mode !== 'sandbox') setMode('sandbox')
  try {
    localStorage.removeItem(PROGRESS_KEY)
    localStorage.removeItem('sarcade-launch-seen')
  } catch { /* Learning progress still resets for this session. */ }
  study = createStudy(curriculum)
  space.resetProgress()
  lastStudy = '0A-1'
  lastAnalysis = '2-1'
  resumeMode = null
  $('about').close()
  showResume()
}
showResume()
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
  if (e.key === 'Escape' && view.maximum && !document.querySelector('dialog[open]')) maximize(view.maximum)
  if (e.code === 'Space' && !e.repeat && e.target === document.body && !document.querySelector('dialog[open]')) {
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
    if (view.mode === 'space') return space.draw()
    optical.draw()
    geometry.draw()
    drawPlots()
  })
})
all('.panel').forEach(panel => resize.observe(panel))
updateControls()
requestFrame()

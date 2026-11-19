import { C } from './physics.js'
import { orbitalConfig, orbitalControls, orbitalDefaults, orbitalDelay, orbitalObservation, radarBands } from './space-model.js'
import { spaceCurriculum } from './space-lessons.js'
import { answerFeedback, canAdvance, controlBaseline, createStudy, currentLesson, STEPS, studyConfig, transition } from './study-state.js'
import { urbanBuildings } from './environments.js'

const canvasIds = ['optical','geometry','profile','raw','image']
const launchStages = [
  'Rocket on the pad','Ignition','Ascent','Sky darkens','Earth’s limb comes into view',
  'Payload separates','Satellite deployed','Solar panels unfold','Radar antenna active','Side-looking observation begins',
]

export function launchStage(progress) {
  return Math.min(launchStages.length-1,Math.max(0,Math.floor(progress*launchStages.length)))
}

const round = (n,digits=1) => Number.isFinite(n) ? n.toFixed(digits) : '—'
const stateTrack = spaceCurriculum.map(phase => ({...phase,lessons:phase.lessons.map(lesson => {
  const def = orbitalControls.find(control => control.key === lesson.key)
  const control = def.values ? {...def,min:0,max:def.values.length-1,step:1} : def
  return {...lesson,controls:[control]}
})}))

function help(control) {
  return `<button type="button" class="info-button" aria-haspopup="dialog" aria-label="About ${control.label}" data-parameter-info="${control.key}"
    data-info-title="${control.label}" data-info-summary="${control.summary}" data-info-details="This control changes the orbital geometry or sampling estimate. Compare the readout with the limits shown below the controls.">ⓘ</button>`
}

function controlMarkup(control,value,guided) {
  const { key,label,unit,values,min,max,step } = control
  const display = values && guided ? values[value] : value
  return `<div class="control-info-row"><label class="space-parameter"><span>${label}</span>
    ${values ? `<select data-space-control="${key}">${values.map((option,i) => `<option value="${guided ? i : option}" ${option===display?'selected':''}>${option}</option>`).join('')}</select>`
      : `<output data-space-output="${key}">${display} ${unit}</output><input data-space-control="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${display}">`}</label>
    ${help(control)}</div>`
}

function launchMarkup(progress) {
  const stage = launchStage(progress), ground = stage < 4, payload = stage >= 5
  const x = ground ? 233 : 150+148*progress, y = ground ? 151-progress*245 : 84-progress*28
  const panels = stage >= 7 ? 45+Math.min(1,(progress-.7)*10)*16 : 5
  return `<svg viewBox="0 0 480 220" role="img" aria-label="${launchStages[stage]}">
    <rect width="480" height="220" fill="${stage<3?'#1a3048':'#030a18'}"/>
    ${Array.from({length:30},(_,i)=>`<circle cx="${(i*73)%470+5}" cy="${(i*113)%180+6}" r="${i%7===0?1.1:.52}" fill="#accbe9" opacity="${stage<3?.15:.74}"/>`).join('')}
    ${ground?'<path d="M0 194h480v26H0z" fill="#293b4c"/><path d="M190 192h103m-84 0v-34h23" stroke="#6b879c" fill="none"/>':'<circle cx="241" cy="568" r="432" fill="#133453" stroke="#33779b" stroke-width="7"/><path d="M0 210q120-91 240-67t240 74" fill="none" stroke="#236868" stroke-width="5"/>'}
    <g transform="translate(${x} ${y})">
    ${payload ? `<rect x="-${panels}" y="-5" width="${panels*2}" height="10" fill="#446ed4"/><path d="M-${panels} 0h${panels*2}" stroke="#94b9ef"/><rect x="-12" y="-10" width="24" height="20" rx="3" fill="#ccdae6"/><path d="M-8 10q8 12 16 0" fill="#67e4e7"/>`
      : `<path d="M-8 19v-30q0-11 8-20 8 9 8 20v30l7 8h-30z" fill="#d3e3e8"/><path d="M-5 11H5" stroke="#568bbd" stroke-width="7"/>${stage>0?'<path d="M-4 23 0 50 4 23" fill="#f0bc68"/>':''}`}
    ${stage>=8?'<path d="M4 20l-24 90 75-6z" stroke="#54c9dd" fill="#65eaf128" stroke-dasharray="5 5"/>':''}
    </g></svg>`
}

export function createSpace(card, dialog) {
  let track = createStudy(stateTrack), sandbox = {...orbitalDefaults}, mode = 'guided'
  let active = false, animation = 0, introSeen = false, launchStart
  try { introSeen = localStorage.getItem('sarcade-launch-seen') === 'yes' } catch { /* Storage is optional. */ }
  const activeConfig = () => mode === 'sandbox' ? sandbox : studyConfig(currentLesson(track))
  function stopLaunch() {
    cancelAnimationFrame(animation)
    launchStart = undefined
    introSeen = true
    try { localStorage.setItem('sarcade-launch-seen','yes') } catch { /* Storage is optional. */ }
  }
  function launchFrame(now) {
    launchStart ??= now
    const progress = Math.min(1,(now-launchStart)/25000)
    const index = launchStage(progress)
    dialog.querySelector('[data-launch-visual]').innerHTML = launchMarkup(progress)
    const status = dialog.querySelector('[data-launch-caption]')
    if (status.dataset.stage !== String(index)) {
      status.textContent = launchStages[index]
      status.dataset.stage = index
    }
    if (progress < 1 && dialog.open) animation = requestAnimationFrame(launchFrame)
    else dialog.close()
  }
  function launch() {
    if (dialog.open) return
    dialog.showModal()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.querySelector('[data-launch-visual]').innerHTML = launchMarkup(1)
      dialog.querySelector('[data-launch-caption]').textContent = 'Satellite in orbit, ready for side-looking observation'
      return
    }
    animation = requestAnimationFrame(launchFrame)
  }
  dialog.addEventListener('close',stopLaunch)

  function draw() {
    if (!active) return
    const config = activeConfig()
    const observation = orbitalObservation(config)
    const details = card.querySelector('[data-orbit-readout]')
    if (details) {
      const look = observation.look
      const labels = [
        ['Slant path',round(look?.range/1000)+' km'],['Round trip',round(look?.range*2000/C,2)+' ms'],
        ['Orbital / track speed',round(observation.speed/1000,2)+' km/s'],['Wavelength',round(observation.wavelength*100,1)+' cm'],
        ['Incidence',round(look?.incidence)+'°'],['One-sided swath',round(observation.width === null ? NaN : observation.width/1000)+' km'],
        ['Ideal range resolution',round(observation.rangeResolution,2)+' m'],['Radial Doppler',round(observation.radialDoppler)+' Hz'],
        ['Circular period',round(observation.period/60)+' min'],['Ground-track shift per orbit',round(observation.nadirShift)+'° west'],
        ['First unambiguous range interval',round(observation.unambiguous/1000)+' km'],
      ]
      const notices = [
        !look && `The beam center misses Earth. Geometric horizon: ${round(observation.horizon)}° off nadir.`,
        observation.beamClips && look && 'The far beam edge extends past the horizon. The displayed far edge is clipped.',
        observation.crossNadir && 'The beam straddles nadir. Swath reports the right-hand portion.',
        config.speedScale !== 1 && 'Hypothetical local track speed. Orbit period still comes from the circular orbit at this altitude.',
        look && 2*observation.apertureDoppler > config.prf && 'PRF is below the estimated full-window stationary Doppler span. A shorter processing window or higher PRF can reduce aliasing.',
        look && observation.delaySpread > 1/config.prf && 'The modeled swath delay spread exceeds one pulse interval. A narrower swath or different timing is needed.',
      ].filter(Boolean)
      details.innerHTML = `<dl>${labels.map(([label,value])=>`<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl>`
        + (notices.length ? `<ul class="orbital-warnings">${notices.map(text=>`<li>${text}</li>`).join('')}</ul>` : '')
    }
    paintMonitors(config,observation)
  }

  function render() {
    const current = currentLesson(track), { lesson,step,confirmed,prediction,edits } = current
    const sandboxing = mode === 'sandbox'
    const control = lesson.controls[0]
    const question = step === 0 ? lesson.predict : lesson.check
    const answer = step === 0 ? prediction : confirmed
    const result = answerFeedback(question,answer)
    card.innerHTML = `<header><h2>Space Mode</h2></header>
      <div class="space-switch"><button data-orbit-mode="guided" aria-pressed="${!sandboxing}">Guided lessons</button>
      <button data-orbit-mode="sandbox" aria-pressed="${sandboxing}">Space Sandbox</button></div>
      <p class="study-scale">Spherical Earth and straight-line propagation. Orbital diagrams and sampling estimates.</p>
      ${sandboxing ? orbitalControls.map(def => controlMarkup(def,sandbox[def.key],false)).join('') : `
        <label class="space-parameter">Choose orbital lesson<select data-space-lesson>${track.lessons.map(item =>
          `<option value="${item.id}" ${lesson.id===item.id?'selected':''}>${track.progress[item.id]?.confirmed===item.check.correct?'✓ ':''}${item.id} · ${item.title}</option>`).join('')}</select></label>
        <h3>${lesson.title}</h3><p class="study-scale">${STEPS[step]}</p>
        ${track.complete ? '<p>You reached the end of Spaceborne SAR.</p>' : `
          <p>${lesson.intro}</p>
          ${step===0 || step===3 ? `<fieldset class="study-question"><legend>${question.prompt}</legend>
            ${question.options.map((choice,i)=>`<label><input type="radio" name="space-answer" data-space-answer="${i}" ${answer===i?'checked':''}> <span>${choice}</span></label>`).join('')}
          </fieldset>` : ''}
          ${step===1 ? controlMarkup(control,edits[control.key]??controlBaseline(lesson,control),true) : ''}
          ${step===2 ? `<p class="study-answer" data-result="${answerFeedback(lesson.predict,prediction)}">${prediction===lesson.predict.correct?'✓ Prediction matches.':'Revisit your prediction with the result in view.'}</p>
            <p class="study-bottom"><strong>Bottom line</strong><br>${lesson.bottom}</p>` : ''}
          <p class="study-feedback" data-space-feedback data-result="${step===3?result:'pending'}" role="status" ${step!==3||confirmed===null?'hidden':''}>${result==='correct'?'✓ Correct.':'Not quite.'} ${lesson.check.feedback}</p>
        `}
        <div class="space-switch"><button type="button" data-space-action="back" ${!track.index&&!step?'disabled':''}>Back</button>
          <button type="button" data-space-action="next" ${track.complete||!canAdvance(current)?'disabled':''}>Next</button>
          <button type="button" data-space-action="repeat">Repeat</button></div>
      `}
      <div class="orbit-readout" data-orbit-readout></div><button type="button" data-launch-replay>Replay launch</button>`
    draw()
  }
  card.addEventListener('click', e => {
    const toggle = e.target.closest('[data-orbit-mode]')?.dataset.orbitMode
    if (toggle) { mode = toggle; render(); return }
    const action = e.target.closest('[data-space-action]')?.dataset.spaceAction
    if (action) { track = transition(track,{type:action}); render(); return }
    if (e.target.closest('[data-launch-replay]')) launch()
  })
  card.addEventListener('input', e => {
    const field = e.target
    const key = field.dataset.spaceControl
    if (key) {
      const spec = orbitalControls.find(item => item.key===key)
      if (mode === 'sandbox') sandbox = orbitalConfig(sandbox,{[key]:spec.values ? field.value : +field.value})
      else {
        track = transition(track,{type:'edit',key,value:+field.value})
        track = transition(track,{type:'observed'})
        card.querySelector('[data-space-action="next"]').disabled = !canAdvance(currentLesson(track))
      }
      const output = card.querySelector(`[data-space-output="${key}"]`)
      if (output) output.textContent = field.value+' '+spec.unit
      draw()
    }
    if (field.dataset.spaceAnswer !== undefined) {
      const {step,lesson} = currentLesson(track)
      track = transition(track,{type:step===0?'predict':'confirm',value:+field.dataset.spaceAnswer})
      const current = currentLesson(track)
      card.querySelector('[data-space-action="next"]').disabled = !canAdvance(current)
      if (step===3) {
        const feedback = card.querySelector('[data-space-feedback]')
        feedback.hidden = false
        feedback.dataset.result = answerFeedback(lesson.check,current.confirmed)
        feedback.textContent = (feedback.dataset.result==='correct'?'✓ Correct. ':'Not quite. ')+lesson.check.feedback
      }
    }
  })
  card.addEventListener('change', e => {
    if (e.target.matches('[data-space-lesson]')) {
      track = transition(track,{type:'select',value:e.target.value})
      render()
    }
  })
  return {
    enter() { active = true; render(); if (!introSeen) launch() },
    leave() { active = false; if (dialog.open) dialog.close() },
    draw,
  }
}

function paintMonitors(config,o) {
  const painters = [mapView, geometryView, delayView, samplingView, stripView]
  canvasIds.forEach((id,i) => {
    const canvas = document.getElementById(id)
    const ratio = Math.min(window.devicePixelRatio || 1,2)
    const bounds = canvas.getBoundingClientRect()
    if (bounds.width < 8 || bounds.height < 8) return
    canvas.width = Math.round(bounds.width*ratio)
    canvas.height = Math.round(bounds.height*ratio)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(canvas.width/320,0,0,canvas.height/180,0,0)
    ctx.fillStyle='#060e20'; ctx.fillRect(0,0,320,180)
    ctx.font='10px system-ui'
    painters[i](ctx,config,o)
  })
}

function text(ctx,string,x,y,color='#a7c8e8') { ctx.fillStyle=color; ctx.fillText(string,x,y) }
function poly(ctx,points,color,dash=[]) {
  ctx.beginPath()
  points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y))
  ctx.strokeStyle=color; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([])
}
function curve(ctx,fn,color) {
  poly(ctx,Array.from({length:121},(_,i) => fn(i/120)),color)
}

function mapView(ctx,c,o) {
  for (let i=0;i<48;i++) {
    ctx.fillStyle=i%6===0?'#7494af':'#38506f'; ctx.fillRect(i*47%319,i*83%166,1,1)
  }
  ctx.beginPath(); ctx.ellipse(162,166,151,110,0,Math.PI,2*Math.PI)
  ctx.fillStyle='#163752'; ctx.fill(); ctx.strokeStyle='#59bfd3'; ctx.stroke()
  curve(ctx,t=>[26+267*t,118-43*Math.sin(Math.PI*t)],'#88e0e7')
  curve(ctx,t=>[26+267*t,138-43*Math.sin(Math.PI*t+o.nadirShift/85)],'#6380a3')
  text(ctx,'ILLUSTRATIVE GROUND TRACKS',15,20)
  text(ctx,`Next orbit shifts about ${round(o.nadirShift)}° west at the equator`,15,159)
}
function geometryView(ctx,c,o) {
  const source=[158,30], origin=[77,142]
  ctx.beginPath(); ctx.ellipse(157,215,176,124,0,Math.PI,2*Math.PI)
  ctx.fillStyle='#18334d'; ctx.fill(); ctx.strokeStyle='#57a6c3'; ctx.stroke()
  ctx.fillStyle='#a8e5f0'; ctx.fillRect(145,25,26,7)
  if (!o.look) {
    poly(ctx,[source,[310,55]],'#f4bc85')
    text(ctx,'Beam misses the spherical surface',31,150,'#f5be84')
    return
  }
  const point = intersection => [158+148*Math.min(1,intersection.central*1.7),92+Math.min(1,intersection.central*1.9)**2*65]
  poly(ctx,[source,point(o.near),point(o.far),source],'#436d88',[3,3])
  poly(ctx,[source,point(o.look)],'#6dedec')
  poly(ctx,[point(o.look),[point(o.look)[0]+17,point(o.look)[1]-27]],'#c6dfef',[2,3])
  text(ctx,`Look ${c.look}° · local incidence ${round(o.look.incidence)}°`,origin[0]-57,151)
  text(ctx,`Spherical ${round(o.look.range/1000)} km · flat ${round(c.altitude/Math.cos(c.look*Math.PI/180))} km`,20,168)
}
function delayView(ctx,c,o) {
  text(ctx,'ROUND-TRIP DELAY ACROSS THE PASS',14,17)
  if (!o.look) return text(ctx,'No ground echo along the selected ray',14,97)
  const center = orbitalDelay(o,0,c), edge = orbitalDelay(o,c.observation/2,c)
  poly(ctx,[[24,26],[24,145],[299,145]],'#415e79')
  curve(ctx,t=>[24+t*275,140-83*(orbitalDelay(o,(t-.5)*c.observation,c)-center)/Math.max(1e-14,edge-center)],'#70e9dd')
  text(ctx,`Closest return ${round(center*1000,3)} ms · edge +${round((edge-center)*1e6,2)} µs`,14,163)
}
function samplingView(ctx,c,o) {
  text(ctx,'PHASE, DOPPLER & PULSE SPACING',14,17)
  const phase = o.phaseError % (Math.PI*2)
  ctx.beginPath(); ctx.arc(63,91,31,0,Math.PI*2); ctx.strokeStyle='#415e79'; ctx.stroke()
  poly(ctx,[[63,91],[63+28*Math.cos(phase),91-28*Math.sin(phase)]],'#66efe1')
  text(ctx,`${round(o.phaseError)} rad extra phase`,15,142)
  const span = o.apertureDoppler
  if (span === null) return
  const half = Math.max(span,c.prf/2,1), y = 105
  poly(ctx,[[121,y],[300,y]],'#415e79')
  const x = v => 210+v*85/half
  poly(ctx,[[x(-span),y-18],[x(span),y-18]],'#6de3dc')
  poly(ctx,[[x(-c.prf/2),y],[x(c.prf/2),y]],'#f4c482')
  text(ctx,'Modeled Doppler span',124,67)
  text(ctx,'Unaliased ±PRF/2',124,129)
  text(ctx,`Target radial component ${round(o.radialDoppler)} Hz`,124,152)
}
function stripView(ctx,c,o) {
  text(ctx,'SWATH COVERAGE · CONCEPTUAL',14,18)
  if (!o.look) return text(ctx,'No centered surface coverage for this look',15,91)
  ctx.fillStyle=c.terrain==='ocean'?'#103b55':c.terrain==='rural'?'#25494d':'#273b4f'
  ctx.fillRect(28,37,264,109)
  if (c.terrain === 'urban') for (const b of urbanBuildings(c.urbanDensity)) {
    ctx.fillStyle=b.height>45?'#909eae':'#50697d'
    ctx.fillRect(157+b.x*.56,91+b.y*.36,b.hx*.72,b.hy*.5)
  }
  const width=Math.min(94,Math.max(8,o.width/3800))
  const length=Math.min(239,Math.max(24,o.azimuthLength/1000))
  ctx.fillStyle='#6becdb27'; ctx.fillRect(38,91-width/2,length,width)
  ctx.strokeStyle='#80ecd9'; ctx.strokeRect(38,91-width/2,length,width)
  text(ctx,`${round(o.azimuthLength/1000)} km track × ${round(o.width/1000)} km one-sided swath`,14,162)
}

import { restoreStudy, snapshotStudy } from './learning-progress.js'
import { C } from './physics.js'
import { orbitalConfig, orbitalControls, orbitalDefaults, orbitalObservation, orbitalPresets } from './space-model.js'
import { spaceCurriculum } from './space-lessons.js'
import { answerFeedback, canAdvance, controlBaseline, createStudy, currentLesson, STEPS, studyConfig, transition } from './study-state.js'
import { paintSpace } from './space-visual.js'
import { orbitChapters, overviewRows, storyMarkup, termNames } from './orbital-story.js'
import { orbitalVocabulary } from './space-lessons.js'

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

function experimentComparison(before,after) {
  const a=orbitalObservation(before), b=orbitalObservation(after)
  const fields=[
    ['Central receive delay',o=>round(o.look?.range*2000/C,3)+' ms'],
    ['Swath receive-window width',o=>o.delaySpread===null?'—':round(o.delaySpread*1000,3)+' ms'],
    ['Ideal range detail',o=>round(o.rangeResolution,2)+' m'],
    ['Residual target Doppler',o=>round(o.radialDoppler)+' Hz'],
    ['One-way path-error phase magnitude',o=>round(o.phaseError,2)+' rad'],
  ]
  return `<dl class="orbit-compare-readout">${fields.map(([label,read])=>`<dt>${label}</dt><dd>${read(a)} → ${read(b)}</dd>`).join('')}
    <dt>Reconstruction surface</dt><dd>${before.focus} → ${after.focus}</dd></dl>
    <p>Use the left signal tabs to read the implications of the experiment. The right image tabs compare the reconstruction, local coverage and elevation model.</p>`
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

export function createSpace(card, dialog, saved, save) {
  let track = restoreStudy(stateTrack,saved?.study), sandbox = {...orbitalDefaults}, mode = 'guided', selectedPreset = ''
  const doc = id => document.getElementById(id)
  const earth = doc('optical')
  const view = {yaw:-.42,pitch:.24,zoom:1,panX:0,panY:0,progress:.55,signal:'range',product:'image',chapter:0,pulses:0,target:1}
  let sensorWorker, requested, queued, revision=0, sceneKey
  let passTimer=0, conceptTimer=0, drag
  let active = false, animation = 0, introSeen = saved?.introSeen === true, launchStart
  const persist = () => save?.({study:snapshotStudy(track),introSeen})
  try { introSeen ||= localStorage.getItem('sarcade-launch-seen') === 'yes' } catch { /* Storage is optional. */ }
  const activeConfig = () => mode === 'sandbox' ? sandbox : studyConfig(currentLesson(track))
  function stopLaunch() {
    cancelAnimationFrame(animation)
    launchStart = undefined
    introSeen = true
    persist()
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

  function requestOrbital(config,compare) {
    const { focus, ...acquisition } = config
    const key=JSON.stringify([acquisition,compare])
    if(key===sceneKey) return
    sceneKey=key
    view.data=null
    view.pulses=0
    view.target=1
    stopPass()
    requested=++revision
    clearTimeout(queued)
    queued=setTimeout(()=>{
      if(!active) return
      if(!sensorWorker) {
        sensorWorker=new Worker(new URL('./orbital-worker.js',import.meta.url),{type:'module'})
        sensorWorker.onmessage=({data})=>{
          if(!active || data.revision!==requested) return
          view.data=data.state
          view.pulses=view.mark==='raw'?0:data.state?.count??0
          paint()
        }
        sensorWorker.onerror=event=>{
          doc('orbit-count').textContent='Orbital engine error'
          console.error(event.message)
        }
      }
      sensorWorker.postMessage({revision:requested,config:acquisition,compare})
    },70)
  }

  function paint() {
    if(!active) return
    const config=activeConfig()
    const o=orbitalObservation(config)
    let geo=config
    if(view.mark==='curvature' && mode==='guided' && currentLesson(track).step===0 && view.chapter>=7) {
      geo={...config,look:view.chapter===7?48:view.chapter===8?o.horizon:o.horizon+5}
    }
    paintSpace(config,o,{...view,geometryConfig:geo,geometryObservation:geo===config?o:orbitalObservation(geo)})
    doc('orbit-scrub').max=view.data?.count??1
    doc('orbit-scrub').value=view.pulses
    doc('orbit-scrub').disabled=!view.data
    doc('orbit-play').disabled=doc('orbit-step').disabled=!view.data
    doc('orbit-count').textContent=view.data?`${view.pulses} / ${view.data.count} pulses`:o.look?'Computing orbital echoes…':'Beam misses Earth'
    const target=card.querySelector('[data-orbit-target]')
    if(target && view.data && target.options.length!==view.data.targets.length) {
      target.innerHTML=view.data.targets.map((t,i)=>`<option value="${i}">Reflector ${t.id}</option>`).join('')
    }
    if(target) target.value=view.target
    document.querySelectorAll('[data-orbital-signal]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.orbitalSignal===view.signal))
    document.querySelectorAll('[data-orbital-product]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.orbitalProduct===view.product))
  }

  function stopPass() {
    clearInterval(passTimer)
    passTimer=0
    doc('orbit-play').textContent='Play pass'
  }
  function setPulseCount(n) {
    view.pulses=Math.max(0,Math.min(view.data?.count??0,n))
    if(view.data) view.progress=view.pulses/view.data.count
    paint()
  }
  doc('orbit-play').onclick=()=>{
    if(passTimer) return stopPass()
    if(!view.data) return
    if(view.pulses>=view.data.count) setPulseCount(0)
    doc('orbit-play').textContent='Pause pass'
    passTimer=setInterval(()=>{
      setPulseCount(view.pulses+1)
      if(view.pulses>=view.data.count) stopPass()
    },55)
  }
  doc('orbit-step').onclick=()=>{
    stopPass()
    setPulseCount(view.pulses>=view.data?.count?1:view.pulses+1)
  }
  doc('orbit-scrub').oninput=e=>{stopPass();setPulseCount(+e.target.value)}
  doc('orbit-reset-camera').onclick=()=>{
    Object.assign(view,{yaw:-.42,pitch:.24,zoom:1,panX:0,panY:0})
    paint()
  }
  function adjustEarth(dx,dy,pan) {
    if(pan) {view.panX+=dx; view.panY+=dy}
    else {view.yaw+=dx*.012; view.pitch=Math.min(1.4,Math.max(-1.4,view.pitch+dy*.01))}
    paint()
  }
  earth.addEventListener('pointerdown',e=>{
    if(!active) return
    drag={id:e.pointerId,x:e.clientX,y:e.clientY}
    earth.setPointerCapture(e.pointerId)
  })
  earth.addEventListener('pointermove',e=>{
    if(!active || drag?.id!==e.pointerId) return
    adjustEarth(e.clientX-drag.x,e.clientY-drag.y,e.shiftKey)
    drag.x=e.clientX;drag.y=e.clientY
  })
  earth.addEventListener('lostpointercapture',()=>{drag=null})
  earth.addEventListener('wheel',e=>{
    if(!active) return
    e.preventDefault()
    view.zoom=Math.max(.55,Math.min(2.3,view.zoom*Math.exp(-e.deltaY*.001)))
    paint()
  },{passive:false})
  earth.addEventListener('keydown',e=>{
    if(!active) return
    const deltas={ArrowLeft:[-11,0],ArrowRight:[11,0],ArrowUp:[0,11],ArrowDown:[0,-11]}
    if(!deltas[e.key]) return
    e.preventDefault()
    adjustEarth(...deltas[e.key],e.shiftKey)
  })
  document.querySelectorAll('[data-orbital-signal]').forEach(b=>b.onclick=()=>{view.signal=b.dataset.orbitalSignal;paint()})
  document.querySelectorAll('[data-orbital-product]').forEach(b=>b.onclick=()=>{view.product=b.dataset.orbitalProduct;paint()})

  function draw() {
    if (!active) return
    const config = activeConfig()
    const observation = orbitalObservation(config)
    const overview=card.querySelector('[data-orbit-overview]')
    if(overview) overview.innerHTML=overviewRows(config)
    const details = card.querySelector('[data-orbit-readout]')
    requestOrbital(config,view.mark==='image')
    if (details) {
      const look = observation.look
      const labels = [
        ['Slant path',round(look?.range/1000)+' km'],['Round trip',round(look?.range*2000/C,2)+' ms'],
        ['Orbital / track speed',round(observation.speed/1000,2)+' km/s'],['Wavelength',round(observation.wavelength*100,1)+' cm'],
        ['Incidence',round(look?.incidence)+'°'],['One-sided swath',round(observation.width === null ? NaN : observation.width/1000)+' km'],
        ['Ideal range resolution',round(observation.rangeResolution,2)+' m'],['Radial Doppler',round(observation.radialDoppler)+' Hz'],
        ['Circular period',round(observation.period/60)+' min'],['Ground-track shift per orbit',round(observation.nadirShift)+'° west'],
        ['First unambiguous range interval',round(observation.unambiguous/1000)+' km'],
        ['Extra path phase',round(observation.phaseError,2)+' rad'],
        ...(view.data?[['Coherent patch aperture',round((view.data.times.at(-1)-view.data.times[0])*observation.speed)+' m']]:[]),
      ]
      const notices = [
        !look && `The beam center misses Earth. Geometric horizon: ${round(observation.horizon)}° off nadir.`,
        observation.beamClips && look && 'The far beam edge extends past the horizon. The displayed far edge is clipped.',
        observation.crossNadir && 'The beam straddles nadir. Swath reports the right-hand portion.',
        config.speedScale !== 1 && 'Hypothetical non-Keplerian track speed. Orbit period still comes from the circular orbit at this altitude.',
        look && 2*observation.apertureDoppler > config.prf && 'PRF is below the estimated full-window stationary Doppler span. A shorter processing window or higher PRF can reduce aliasing.',
        look && observation.delaySpread > 1/config.prf && 'The modeled swath delay spread exceeds one pulse interval. A narrower swath or different timing is needed.',
      ].filter(Boolean)
      details.innerHTML = `<dl>${labels.map(([label,value])=>`<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl>`
        + (notices.length ? `<ul class="orbital-warnings">${notices.map(text=>`<li>${text}</li>`).join('')}</ul>` : '')
    }
    paint()
  }

  function render() {
    const current = currentLesson(track), { lesson,step,confirmed,prediction,edits } = current
    const sandboxing = mode === 'sandbox'
    const mark=sandboxing?'sandbox':lesson.mark
    if(mark!==view.mark || view.term) {
      clearInterval(conceptTimer)
      view.mark=mark
      view.signal=({velocity:'doppler',motion:'doppler',timing:'timing',swath:'timing',raw:'raw',band:'iq',phase:'iq',image:'raw'})[mark]??'range'
      view.product=({overview:'coverage',swath:'coverage',track:'coverage',strip:'coverage',image:'compare'})[mark]??'image'
      view.chapter=0
      view.term=null
      view.progress=.55
      if(mark==='raw') view.pulses=0
    }
    document.querySelector('[data-orbital-product="compare"]').hidden=mark!=='image'
    const control = lesson.controls[0]
    const question = step === 0 ? lesson.predict : lesson.check
    const answer = step === 0 ? prediction : confirmed
    const result = answerFeedback(question,answer)
    card.innerHTML = `<header><h2>Space Mode</h2></header>
      <div class="space-switch"><button data-orbit-mode="guided" aria-pressed="${!sandboxing}">Guided lessons</button>
      <button data-orbit-mode="sandbox" aria-pressed="${sandboxing}">Space Sandbox</button></div>
      <p class="study-scale">Spherical Earth · simulated coherent echoes from a local teaching patch</p>
      ${sandboxing ? `<label class="space-parameter">Orbital preset<select data-orbital-preset><option value="">Custom</option>
        ${Object.keys(orbitalPresets).map(name=>`<option ${name===selectedPreset?'selected':''}>${name}</option>`).join('')}</select></label>`
      + orbitalControls.map(def => controlMarkup(def,sandbox[def.key],false)).join('') : `
        <label class="space-parameter">Choose orbital lesson<select data-space-lesson>${track.lessons.map(item =>
          `<option value="${item.id}" ${lesson.id===item.id?'selected':''}>${track.progress[item.id]?.confirmed===item.check.correct?'✓ ':''}${item.id} · ${item.title}</option>`).join('')}</select></label>
        <h3>${lesson.title}</h3><p class="study-scale">${STEPS[step]}</p>
        ${track.complete ? '<p>You reached the end of Spaceborne SAR.</p>' : `
          <p>${lesson.intro}</p>
          ${step<=2 ? storyMarkup(lesson,activeConfig()) : ''}
          ${step===0 || step===3 ? `<fieldset class="study-question"><legend>${question.prompt}</legend>
            ${question.options.map((choice,i)=>`<label><input type="radio" name="space-answer" data-space-answer="${i}" ${answer===i?'checked':''}> <span>${choice}</span></label>`).join('')}
          </fieldset>` : ''}
          ${step===1 ? `<p class="study-scale">Adjust the unlocked control and read the updated monitor.</p>${controlMarkup(control,edits[control.key]??controlBaseline(lesson,control),true)}` : ''}
          ${step===2 ? `<p class="study-answer" data-result="${answerFeedback(lesson.predict,prediction)}">${prediction===lesson.predict.correct?'✓ Prediction matches.':'Revisit your prediction with the result in view.'}</p>
            <p><strong>What changed?</strong> ${lesson.changed}</p>
            <details><summary>Compare the signal and product</summary>${experimentComparison(lesson.baseline,activeConfig())}</details>
            <details><summary>Why mathematically?</summary><p>${lesson.math}</p></details>
            <p class="study-bottom"><strong>Bottom line</strong><br>${lesson.bottom}</p>` : ''}
          <p class="study-feedback" data-space-feedback data-result="${step===3?result:'pending'}" role="status" ${step!==3||confirmed===null?'hidden':''}>${result==='correct'?'✓ Correct.':'Not quite.'} ${lesson.check.feedback}</p>
        `}
        <div class="space-switch"><button type="button" data-space-action="back" ${!track.index&&!step?'disabled':''}>Back</button>
          <button type="button" data-space-action="next" ${track.complete||!canAdvance(current)?'disabled':''}>Next</button>
          <button type="button" data-space-action="repeat">Repeat</button></div>
      `}
      <details class="orbit-reference"><summary>Orbital vocabulary</summary>${orbitalVocabulary.map(([name,description,bottom],i)=>`
        <div class="orbit-term"><button class="info-button" type="button" aria-label="About ${name}" data-parameter-info="orbital-term"
          data-info-title="${name}" data-info-summary="${bottom}" data-info-details="${description}">ⓘ</button>
          <button type="button" data-orbit-term="${i}">${name}</button></div>`).join('')}</details>
      <label class="space-parameter">Track scatterer<select data-orbit-target><option value="1">Reflector B</option></select></label>
      <label class="check"><input type="checkbox" data-orbit-overlay ${view.overlay?'checked':''}> Reference marker overlay</label>
      <div class="orbit-readout" data-orbit-readout></div><button type="button" data-launch-replay>Replay launch</button>`
    const caption=card.querySelector('[data-orbit-caption]')
    if(caption) caption.textContent=orbitChapters(view.mark)[view.chapter]
    draw()
  }
  card.addEventListener('click', e => {
    const term = e.target.closest('[data-orbit-term]')?.dataset.orbitTerm
    if(term!==undefined) {
      view.term=termNames[+term]
      if(view.term==='Ground track') view.mark='track'
      else if(view.term==='Nadir') {
        view.mark='nadir'
        view.chapter=0
      } else view.mark='overview'
      paint()
      return
    }
    const chapter = e.target.closest('[data-orbit-chapter]')?.dataset.orbitChapter
    if(chapter) {
      const steps=orbitChapters(currentLesson(track).lesson.mark)
      view.mark=currentLesson(track).lesson.mark
      view.term=null
      view.chapter=chapter==='replay'?0:Math.max(0,Math.min(steps.length-1,view.chapter+(chapter==='next'?1:-1)))
      const caption=card.querySelector('[data-orbit-caption]')
      if(caption) caption.textContent=steps[view.chapter]
      clearInterval(conceptTimer)
      view.progress=.18
      paint()
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        conceptTimer=setInterval(()=>{
          view.progress+=.025
          paint()
          if(view.progress>=1) clearInterval(conceptTimer)
        },45)
      }
      return
    }
    const toggle = e.target.closest('[data-orbit-mode]')?.dataset.orbitMode
    if (toggle) { mode = toggle; render(); return }
    const action = e.target.closest('[data-space-action]')?.dataset.spaceAction
    if (action) { track = transition(track,{type:action}); persist(); render(); return }
    if (e.target.closest('[data-launch-replay]')) launch()
  })
  card.addEventListener('input', e => {
    const field = e.target
    if(field.matches('[data-orbit-target]')) {view.target=+field.value;paint();return}
    if(field.matches('[data-orbit-overlay]')) {view.overlay=field.checked;paint();return}
    if(field.matches('[data-orbital-preset]') && orbitalPresets[field.value]) {
      selectedPreset=field.value
      sandbox={...orbitalPresets[field.value]}
      render()
      return
    }
    const key = field.dataset.spaceControl
    if (key) {
      const spec = orbitalControls.find(item => item.key===key)
      if (mode === 'sandbox') {
        sandbox = orbitalConfig(sandbox,{[key]:spec.values ? field.value : +field.value})
        selectedPreset=''
        const preset=card.querySelector('[data-orbital-preset]')
        if(preset) preset.value=''
      }
      else {
        track = transition(track,{type:'edit',key,value:+field.value})
        track = transition(track,{type:'observed'})
        persist()
        card.querySelector('[data-space-action="next"]').disabled = !canAdvance(currentLesson(track))
      }
      const output = card.querySelector(`[data-space-output="${key}"]`)
      if (output) output.textContent = field.value+' '+spec.unit
      draw()
    }
    if (field.dataset.spaceAnswer !== undefined) {
      const {step,lesson} = currentLesson(track)
      track = transition(track,{type:step===0?'predict':'confirm',value:+field.dataset.spaceAnswer})
      persist()
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
      persist()
      render()
    }
  })
  return {
    enter() { active=true; earth.tabIndex=0; render(); if(!introSeen) launch() },
    leave() { active=false; sceneKey=undefined; earth.removeAttribute('tabindex'); clearTimeout(queued);
      clearInterval(conceptTimer); stopPass(); if(dialog.open) dialog.close() },
    resetProgress() { track = createStudy(stateTrack); introSeen = false; mode = 'guided' },
    draw,
  }
}

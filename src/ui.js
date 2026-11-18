import { DEFAULTS, SCENARIOS } from './physics.js'

const paths = {
  radar: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l7-7m-7 7v.01M12 2v2m10 8h-2M12 22v-2M2 12h2"/>',
  optical: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.7"/>',
  coords: '<path d="M12 3v9m0 0 8 5m-8-5-8 5M9 6l3-3 3 3m2 11h3v-3M4 14v3h3m5-5v9"/>',
  signal: '<path d="M2 12h4l3-7 4 14 3-8h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m3 17 5-4 4 3 4-6 5 6"/>',
  expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
  shrink: '<path d="M4 8h4V4m12 4h-4V4M8 20v-4H4m12 4v-4h4"/>',
  truck: '<path d="M2 6h12v11H2zm12 4h4l4 4v3h-8"/><circle cx="7" cy="17" r="2" fill="currentColor"/><circle cx="18" cy="17" r="2" fill="currentColor"/>',
  mountain: '<path d="m2 19 6-10 4 6 4-10 6 14H2Z"/>',
  move: '<path d="M3 12h17m-6-6 6 6-6 6M3 7h4m-4 10h4"/>',
  waves: '<path d="M2 8c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2M2 13c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2M2 18c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/>',
  study: '<path d="M3 5h6c2 0 3 1 3 2v13c0-2-1-3-3-3H3zm18 0h-6c-2 0-3 1-3 2v13c0-2 1-3 3-3h6z"/>',
  sliders: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="#111d2c"/><circle cx="15" cy="12" r="2" fill="#111d2c"/><circle cx="10" cy="17" r="2" fill="#111d2c"/>',
  play: '<path d="m8 5 11 7-11 7Z" fill="currentColor"/>',
  pause: '<path d="M8 5h2v14H8zm6 0h2v14h-2z" fill="currentColor"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  step: '<path d="m5 6 9 6-9 6Z" fill="currentColor"/><path d="M18 6v12"/>',
  target: '<circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.4.9-1.5 1.4-1.5 2m0 3h.01"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
}

export function icon(name, size = 16) {
  return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>'
}

const controls = [
  ['bandwidth', 'Bandwidth', 24, 72, 1, 'MHz', 'Wider bandwidth improves separation in slant range.'],
  ['prf', 'Pulse repetition frequency', 12, 36, 1, 'Hz', 'Pulse Repetition Frequency (PRF) is how often the radar transmits.'],
  ['look', 'Look angle', 18, 53, 1, '°', 'Angle between straight down and the look direction at mid-aperture.'],
  ['speed', 'Platform speed', 45, 120, 1, 'm/s', 'Along-track platform speed.'],
  ['altitude', 'Platform altitude', 320, 750, 10, 'm', 'Height above the flat scene.'],
  ['noise', 'Receiver noise', 0, 0.18, 0.004, '', 'Deterministic additive complex baseband noise.'],
  ['targetX', 'Vehicle azimuth', -170, 170, 1, 'm', 'Vehicle position along the flight path at mid-aperture.'],
  ['targetY', 'Vehicle ground range', -125, 125, 1, 'm', 'Vehicle position perpendicular to the flight path at mid-aperture.'],
  ['targetSpeed', 'Vehicle speed', 0, 22, 1, 'm/s', 'Motion is included in range, phase, and Doppler.'],
  ['heading', 'Vehicle heading', 0, 360, 1, '°', 'Counterclockwise from the platform flight direction.'],
  ['rcs', 'Vehicle reflectivity', 0.1, 1.8, 0.05, '×', 'Relative amplitude weight inspired by Radar Cross Section (RCS).'],
]

export function controlMarkup([id, label, min, max, step, unit, title]) {
  return '<label class="slider-label" title="'+title+'"><span>'+label+'</span><output id="'+id+'-out"></output>' +
    '<input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+DEFAULTS[id]+'" data-unit="'+unit+'"></label>'
}

function panel(id, iconName, title, note, content, footer) {
  return '<section class="panel" id="panel-'+id+'" aria-labelledby="title-'+id+'">' +
    '<header class="panel-header"><div class="panel-title"><span class="panel-icon">'+icon(iconName,18)+'</span><h2 id="title-'+id+'">'+title+
    '</h2><span class="panel-note">'+note+'</span></div><button type="button" class="icon-button maximize" data-panel="'+id+'" title="Maximize '+title+'" aria-label="Maximize '+title+'">'+icon('expand')+'</button></header>' +
    content + (footer ? '<footer class="panel-footer">'+footer+'</footer>' : '') + '</section>'
}

export function renderLayout(root) {
  root.innerHTML = `
    <header class="masthead">
      <div class="brand"><div class="brand-symbol">${icon('radar',27)}</div><div><h1>SAR War Room</h1><p>Synthetic Aperture Radar Simulator</p></div></div>
      <nav class="mode-switch" aria-label="Learning mode">
        <button id="sandbox-mode" aria-pressed="true">${icon('sliders')} <span>Sandbox</span></button>
        <button id="study-mode" aria-pressed="false">${icon('study')} <span>Study Mode</span></button>
      </nav>
      <div class="header-actions"><span class="engine-state"><i></i><span id="engine-status">INITIALIZING</span></span><button id="help" class="icon-button help" aria-label="About the simulation" title="About the simulation">${icon('help',18)}</button></div>
    </header>
    <main class="workspace">
      <aside class="sidebar" aria-label="Simulation controls">
        <section id="study-card" class="sidebar-card" hidden></section>
        <section id="scenarios-card" class="sidebar-card">
          <h2>${icon('layers')} Scenario</h2>
          <div class="scenario-list">${SCENARIOS.map(s => '<button class="scenario" data-scenario="'+s.id+'" aria-pressed="false"><span class="scenario-symbol">'+icon(s.icon,17)+'</span><span><strong>'+s.name+'</strong><small>'+s.detail+'</small></span>'+icon('chevron',13)+'</button>').join('')}</div>
        </section>
        <section id="radar-card" class="sidebar-card">
          <h2>${icon('sliders')} Radar parameters</h2>
          <label class="select-label" title="Carrier frequency determines wavelength and phase sensitivity."><span>Carrier frequency</span><select id="frequency"><option value="42">42 MHz</option><option value="56">56 MHz</option><option value="70">70 MHz</option></select></label>
          ${controls.slice(0,4).map(controlMarkup).join('')}
          <label class="select-label"><span>Simulation quality</span><select id="quality"><option value="interactive">Interactive</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <details><summary>Platform &amp; scene</summary><div class="details-content">${controls.slice(4).map(controlMarkup).join('')}<label class="check"><input type="checkbox" id="clutter" checked> Ground clutter</label></div></details>
        </section>
        <section class="sidebar-card view-card">
          <h2>${icon('optical')} Display options</h2>
          <div class="check-grid">
            <label class="check"><input type="checkbox" data-option="outbound" checked> Transmit pulse</label>
            <label class="check"><input type="checkbox" data-option="echo" checked> Return echo</label>
            <label class="check"><input type="checkbox" data-option="footprint" checked> Footprint</label>
            <label class="check" title="Line of Sight (LOS) between platform and selected object"><input type="checkbox" data-option="los" checked> Line of sight</label>
            <label class="check"><input type="checkbox" data-option="labels" checked> Object labels</label>
            <label class="check"><input type="checkbox" data-option="velocity" checked> Velocity</label>
            <label class="check"><input type="checkbox" data-option="range"> Range label</label>
          </div>
        </section>
      </aside>
      <div class="monitors" id="monitors">
        <div class="monitor-row" id="top-row">
          ${panel('optical','optical','Optical View','Ground truth',
            '<div class="scene-wrap"><canvas id="optical" aria-label="Interactive perspective terrain and selected vehicle"></canvas><span class="scene-chip ground-chip"><i></i> <span id="scenario-tag">GROUND TRUTH</span></span><button class="scene-button" id="reset-optical" title="Reset optical camera" aria-label="Reset optical camera">'+icon('target',17)+'</button></div>',
            '<span><i class="dot lime"></i><span id="optical-object">Survey vehicle</span></span><span class="muted">Drag to orbit · Shift + drag to pan · Scroll to zoom</span>')}
          <div class="splitter vertical" data-split="top" role="separator" tabindex="0" aria-label="Resize top monitors" aria-orientation="vertical"></div>
          ${panel('geometry','coords','Radar Geometry','3D propagation',
            '<div class="scene-wrap"><canvas id="geometry" aria-label="Interactive 3D projection of the radar platform, terrain and signal paths"></canvas><div class="telemetry"><div><span>SLANT RANGE</span><strong id="obs-range">—</strong></div><div><span>DOPPLER</span><strong id="obs-doppler">—</strong></div><div><span>ROUND TRIP</span><strong id="obs-delay">—</strong></div><div title="Coherent phase, wrapped to one revolution"><span>PHASE</span><strong id="obs-phase">—</strong></div></div><button class="scene-button" id="reset-geometry" title="Reset radar camera" aria-label="Reset radar camera">'+icon('target',17)+'</button></div>',
            '<span><i class="dot cyan"></i> Transmit</span><span><i class="dot amber"></i> Echo</span><span><i class="dot teal"></i> Footprint</span><span class="muted push">Illustrative geometry</span>')}
        </div>
        <div class="splitter horizontal" data-split="rows" role="separator" tabindex="0" aria-label="Resize monitor rows" aria-orientation="horizontal"></div>
        <div class="monitor-row" id="bottom-row">
          ${panel('signal','signal','Received Signal','Complex baseband',
            '<div class="signal-content"><div class="plot-toolbar"><div class="segmented" aria-label="Signal representation"><button data-tab="range" aria-pressed="true">Range profile</button><button data-tab="iq" aria-pressed="false" title="In-phase and Quadrature components">I/Q</button><button data-tab="doppler" aria-pressed="false">Doppler</button></div><label class="check contribution"><input type="checkbox" id="contributions"> Contributions</label></div><canvas class="plot" id="profile" aria-label="Current received pulse profile"></canvas><div class="plot-heading"><strong>Raw SAR data</strong><span>Pulse × slant range</span></div><canvas class="plot" id="raw" aria-label="Acquired raw radar sample matrix"></canvas></div>',
            '<span><i class="dot cyan"></i><span id="signal-key">Total return</span></span><span id="signal-ground" hidden><i class="dot blue"></i> Ground</span><span id="signal-extra" hidden><i class="dot amber"></i><span id="signal-extra-label">Selected target</span></span><span class="muted push" id="signal-count">—</span>')}
          <div class="splitter vertical" data-split="bottom" role="separator" tabindex="0" aria-label="Resize bottom monitors" aria-orientation="vertical"></div>
          ${panel('image','image','SAR Image','Processing',
            '<div class="image-content"><div class="plot-toolbar"><label class="stage-label" for="stage">Processing stage</label><select id="stage"><option value="focused">Focused image</option><option value="raw">Raw echoes</option><option value="range">Range compression</option><option value="migration">Reference-point migration correction</option></select><span class="image-unit" title="Decibels relative to a fixed display reference">dB</span></div><canvas class="plot" id="image" aria-label="Image reconstructed from the acquired complex echoes"></canvas></div>',
            '<span><i class="dot lime"></i><span id="image-key">Coherent backprojection</span></span><span class="muted push" id="image-size">—</span>')}
        </div>
      </div>
    </main>
    <section class="transport" aria-label="Timeline and playback">
      <div class="transport-controls">
        <button class="icon-button play" id="play" title="Play (Space)" aria-label="Play">${icon('play',19)}</button>
        <button class="icon-button" id="reset" title="Restart at first pulse" aria-label="Restart">${icon('reset',17)}</button>
        <button class="icon-button" id="step" title="Step one radar pulse" aria-label="Step one pulse">${icon('step',17)}</button>
        <select id="rate" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
      </div>
      <div class="timeline"><div class="time-meta"><span id="timeline-label">FLIGHT TIMELINE</span><output id="clock">0.00 / 8.00 s</output></div><input id="scrub" type="range" min="0" max="192" value="0" aria-label="Flight timeline"><div class="timeline-ticks" aria-hidden="true"><span>0 s</span><span>2 s</span><span>4 s</span><span>6 s</span><span>8 s</span></div></div>
      <div class="segmented capture-mode" aria-label="Acquisition mode"><button id="flight" aria-pressed="true">Flight</button><button id="instant" aria-pressed="false">Single Instant</button></div>
    </section>
    <dialog id="about"><header><h2>About the simulation</h2><button class="icon-button" id="close-help" aria-label="Close">${icon('close')}</button></header>
      <p>Synthetic Aperture Radar (SAR) combines radio echoes from many positions along a flight path to form an image.</p>
      <p><strong>Geometry.</strong> The engine computes slant range <var>R</var>, round-trip delay <span class="formula">2R/c</span>, wrapped phase <span class="formula">−4πR/λ</span>, and Doppler <span class="formula">−(2/λ) dR/dt</span>. Here <var>c</var> is the speed of light and <var>λ</var> is the carrier wavelength.</p>
      <p><strong>Receiver.</strong> In-phase and Quadrature (I/Q) are the real and imaginary parts of the coherently summed signal. The ground and the vehicle both scatter. Noise is added at the receiver.</p>
      <p><strong>Processing.</strong> A matched filter compresses the chirp. Backprojection interpolates each pixel’s changing range and compensates its phase before summing the acquired pulses. The separate migration view aligns one stationary reference point. Moving objects may shift or smear under the stationary-scene assumption.</p>
      <p><strong>Teaching scale.</strong> The flight uses compressed dimensions and low carrier frequencies to keep the pulse count manageable. The 3D rays illustrate direction and timing qualitatively. The model uses flat terrain, approximate reflectivity, and a simplified beam envelope. The dB scales show relative amplitude.</p>
    </dialog>
  `
}

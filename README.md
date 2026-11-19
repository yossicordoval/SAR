# SARcade

Interactive Synthetic Aperture Radar Lab

SARcade (SAR + Arcade) is a browser-based lab for predicting, experimenting with, and inspecting synthetic aperture radar. The four monitors share one flight, one selected object, and one acquired pulse history. The initial view opens partway through a paused flight so you can inspect the echoes and image. Restart begins at the first pulse.

## Run in a clean workspace

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

The development server listens on port 5173 and binds to all interfaces for cloud port forwarding. Use the cloud provider’s HTTP preview for that port when available. To deploy a static build, run `npm run build` and serve `dist/` over HTTP. No backend, environment variables, GPU, or external assets are required. `npm test` runs the numerical regression suite.

## Try it

- Use **Choose Lesson** to jump between radar parameters, signal displays, image formation, image analysis, and advanced environments. Lesson progress is stored in this browser. Use **Resume learning** after reopening, or reset the saved record from About.
- Use **Image Analysis** to interpret evidence before revealing simulator ground truth.
- Open **Space Mode** and start with the airborne-to-orbital comparison. Step through the recorded orbital pulses, try the signal tabs, and compare the focused patch with the swath diagram. Use Space Sandbox for presets and free exploration.
- Use **Study Mode** to predict what reaches the receiver, then play the demonstration with separate ground and vehicle contributions.
- In **Sandbox**, switch to **Moving vehicle**, open the **Doppler** tab, and compare the actual curve with the stationary prediction. Expand **Platform & scene** to change the vehicle’s heading, speed, or position.
- Drag or use the arrow keys on a divider to resize the monitors. The expand control maximizes a monitor. Drag a scene to orbit, Shift-drag to pan, and scroll to zoom. Select a vehicle or rock to highlight its contribution.
- Scrub backward to reconstruct from an earlier pulse prefix. **Single Instant** uses exactly one pulse, which shows why one observation cannot resolve position along the flight path.

## Model

The worker computes geometric slant range, two-way delay and Doppler, coherent carrier phase, and complex echoes of a finite-duration linear chirp. Each pulse includes deterministic ground scatterers and receiver noise. The return amplitude uses an approximate distance loss, a broad illumination envelope, and relative reflectivity. Interactive, Medium, and High change spatial sampling. Pulse Repetition Frequency separately controls slow-time sampling. Low PRF relative to the actual Doppler can produce ambiguity.

The matched filter compresses echoes in range. The reference-point migration view aligns the predicted range of one stationary point. For the ground image, coherent backprojection instead interpolates at each pixel’s predicted range on each acquired pulse and corrects phase before summing. This stationary, flat-ground assumption can shift or smear a moving object. The green image reticle marks the current ground-truth position and can be turned off using Object labels.

The terrain within the simulated swath is flat. Perspective artwork and propagation animations communicate direction qualitatively. Carrier frequency, flight dimensions, and pulse counts are chosen for teaching. The displays are relative amplitude and the simulator is uncalibrated.


The urban scene uses opaque rectangular buildings, elevated roof returns, and simplified wall–ground scattering. Surface patch strengths are qualitative and depend on viewing geometry and wavelength. Ground image formation still assumes a flat grid, so elevated objects can be misplaced. In the motion-compensation exercise, the same acquired echoes are reprocessed with a known velocity hypothesis. The aperture exercise reports the connected along-track width at half power on the row crossing the reflector.


## Terrain and orbital models

In **Terrain Analysis**, change the height field, direction, slope and look side. Flat and elevation-aware backprojection use the same recorded I/Q. The geocoded option remaps the flat focused image using a mid-pass equal-range approximation. Missing or already overlapped echoes remain ambiguous after this remapping.

The DEM scenes use bounded procedural height fields and geometric line-of-sight tests. The urban diagnostic can isolate model roof, wall, wall–ground corner and vehicle contributions in guided lessons. These categories describe simulated inputs. Interpreting scattering mechanisms in measured imagery requires independent evidence.

Space Mode uses a nominal spherical Earth and circular orbital positions, plus selectable hypothetical speeds. The orbital worker generates coherent I/Q, matched-filter output and focused images over a 280 m × 210 m reference patch. It uses actual pulse spacing and a bounded aperture around closest approach. Swath and range ambiguity displays use ideal receive-window geometry. The patch uses independent receive windows, relative amplitudes and a fixed Earth during each short aperture.

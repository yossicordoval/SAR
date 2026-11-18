# SAR War Room

A browser-based Synthetic Aperture Radar teaching simulator. The four monitors share one flight, one selected object, and one acquired pulse history. The initial view opens partway through a paused flight so you can inspect the echoes and image. Restart begins at the first pulse.

## Run in a clean workspace

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

The development server listens on port 5173 and binds to all interfaces for cloud port forwarding. Use the cloud provider’s HTTP preview for that port when available. To deploy a static build, run `npm run build` and serve `dist/` over HTTP. No backend, environment variables, GPU, or external assets are required. `npm test` runs the numerical regression suite.

## Try it

- Use **Study Mode** to predict what reaches the receiver, then play the demonstration with separate ground and vehicle contributions.
- In **Sandbox**, switch to **Moving vehicle**, open the **Doppler** tab, and compare the actual curve with the stationary prediction. Expand **Platform & scene** to change the vehicle’s heading, speed, or position.
- Drag or use the arrow keys on a divider to resize the monitors. The expand control maximizes a monitor. Drag a scene to orbit, Shift-drag to pan, and scroll to zoom. Select a vehicle or rock to highlight its contribution.
- Scrub backward to reconstruct from an earlier pulse prefix. **Single Instant** uses exactly one pulse, which shows why one observation cannot resolve position along the flight path.

## Model

The worker computes geometric slant range, two-way delay and Doppler, coherent carrier phase, and complex echoes of a finite-duration linear chirp. Each pulse includes deterministic ground scatterers and receiver noise. The return amplitude uses an approximate distance loss, a broad illumination envelope, and relative reflectivity. Interactive, Medium, and High change spatial sampling. Pulse Repetition Frequency separately controls slow-time sampling. Low PRF relative to the actual Doppler can produce ambiguity.

The matched filter compresses echoes in range. The reference-point migration view aligns the predicted range of one stationary point. For the ground image, coherent backprojection instead interpolates at each pixel’s predicted range on each acquired pulse and corrects phase before summing. This stationary, flat-ground assumption can shift or smear a moving object. The green image reticle marks the current ground-truth position and can be turned off using Object labels.

The terrain within the simulated swath is flat. Perspective artwork and propagation animations communicate direction qualitatively. Carrier frequency, flight dimensions, and pulse counts are chosen for teaching. The displays are relative amplitude and the simulator is uncalibrated.

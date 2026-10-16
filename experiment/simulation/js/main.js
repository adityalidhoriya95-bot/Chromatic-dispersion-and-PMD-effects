(function () {
  // Physics constants
  const D = 17;          // chromatic dispersion, ps/(nm.km)
  const DLAMBDA = 0.1;   // source spectral width, nm
  const DPMD = 0.1;      // PMD coefficient, ps/sqrt(km)

  const $ = id => document.getElementById(id);
  const scene = document.querySelector('a-scene');
  const lenSlider = $('lenSlider');
  const rateSlider = $('rateSlider');

  let paused = false;
  let progress = 0;       // 0 = laser, 1 = receiver
  let spread = 1;         // how stretched the pulse looks
  let last = performance.now();

  function compute() {
    const L = parseFloat(lenSlider.value);
    const B = parseFloat(rateSlider.value);
    const cd = D * L * DLAMBDA;
    const pmd = DPMD * Math.sqrt(L);
    const total = Math.sqrt(cd * cd + pmd * pmd);
    const T = 1000 / B;   // bit period in ps
    return { L, B, cd, pmd, total, T };
  }

  function updateLabels() {
    $('lenLabel').textContent = 'Fiber Length: ' + lenSlider.value + ' km';
    $('rateLabel').textContent = 'Data Rate: ' + rateSlider.value + ' Gb/s';
    const r = compute();
    spread = 1 + Math.min(5, (r.total / r.T) * 3);
  }

  lenSlider.addEventListener('input', updateLabels);
  rateSlider.addEventListener('input', updateLabels);
  updateLabels();

  // Pulse animation
  function startLoop() {
    const pulse = $('pulse');
    function frame(now) {
      const dt = now - last;
      last = now;
      if (!paused) progress = (progress + dt / 3500) % 1;
      pulse.object3D.position.x = -4 + 8 * progress;
      pulse.object3D.scale.x = 1 + (spread - 1) * progress;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (scene.hasLoaded) startLoop();
  else scene.addEventListener('loaded', startLoop);

  // Camera controls
  function zoom(step) {
    const rig = $('rig');
    const p = rig.getAttribute('position');
    rig.setAttribute('position', { x: p.x, y: p.y, z: Math.min(18, Math.max(3, p.z + step)) });
  }
  function rotate(deg) {
    $('lab').object3D.rotation.y += deg * Math.PI / 180;
  }

  $('zoomInBtn').onclick = () => zoom(-1);
  $('zoomOutBtn').onclick = () => zoom(1);
  $('rotLeftBtn').onclick = () => rotate(15);
  $('rotRightBtn').onclick = () => rotate(-15);

  // Simulation controls
  $('pauseBtn').onclick = function () {
    paused = !paused;
    this.textContent = paused ? 'Resume Pulse' : 'Pause Pulse';
  };

  $('resetBtn').onclick = function () {
    progress = 0;
    paused = false;
    $('pauseBtn').textContent = 'Pause Pulse';
    lenSlider.value = 50;
    rateSlider.value = 100;
    updateLabels();
    $('rig').setAttribute('position', { x: 0, y: 2, z: 9 });
    $('lab').object3D.rotation.y = 0;
    $('results').textContent = 'Press "Calculate Results" to see the pulse broadening.';
  };

  // Results
  $('calcBtn').onclick = function () {
    const r = compute();
    const ok = r.total < r.T / 4;
    $('results').innerHTML =
      'Fiber length: ' + r.L + ' km<br>' +
      'Data rate: ' + r.B + ' Gb/s (bit period ' + r.T.toFixed(1) + ' ps)<br>' +
      'Chromatic dispersion: ' + r.cd.toFixed(1) + ' ps<br>' +
      'PMD: ' + r.pmd.toFixed(2) + ' ps<br>' +
      'Total broadening: ' + r.total.toFixed(1) + ' ps<br>' +
      '<b>' + (ok ? 'Link OK: broadening is under a quarter of the bit period.'
                  : 'Link limited by dispersion: broadening is over a quarter of the bit period.') + '</b>';
  };

  $('vrBtn').onclick = function () {
    if (scene.enterVR) scene.enterVR();
  };
})();


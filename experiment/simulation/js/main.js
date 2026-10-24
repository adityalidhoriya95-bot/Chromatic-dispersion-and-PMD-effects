import * as THREE from 'three';

        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

        import { VRButton } from 'three/addons/webxr/VRButton.js';

        import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

        // --- Global State ---

        const state = {

            fiberLength: 50,       // km (1 - 100)

            dataRate: 10,          // Gb/s (1 - 40)

            wavelength: 1550,      // nm (1310 - 1620)

            polAngle: 45,          // deg (0 - 90)

            dispersionD: 17.0,     // ps/(nmkm)*

            laserLinewidth: 0.1,   // nm

            pmdDgdCoeff: 0.5,      // ps/sqrt(km)

            isPaused: false,

            pulsePos: -1.5,

            isVRFallbackMode: false

        };

        let scene, camera, renderer, controls;

        let roomGroup, breadboardMesh;

        let labInstruments = []; // Grabbable 3D instruments list

        let patchCords = [];      // Connecting fiber cables

        let pulseGroup;

        // Active Screens & Canvas Textures

        let funcGenCtx, funcGenTexture;

        let laserCtx, laserTexture;

        let scopeCtx, scopeTexture;

        let compCtx, compTexture;

        // WebXR Controllers

        let controller1, controller2;

        let controllerGrip1, controllerGrip2;

        let raycaster, tempMatrix;

        let grabbedObject = null;

        let desktopDraggedObject = null;

        let mousePlane, mouseRaycaster, mouse;

        init();

        animate();

        function init() {

            const container = document.getElementById('viewport-container');

            // 1. Scene Setup

            scene = new THREE.Scene();

            scene.background = new THREE.Color(0x070d19);

            scene.fog = new THREE.FogExp2(0x070d19, 0.025);

            // 2. Camera Setup

            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

            camera.position.set(0, 1.7, 2.5);

            // 3. WebGL Renderer & WebXR Configuration

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            renderer.setSize(window.innerWidth, window.innerHeight);

            renderer.shadowMap.enabled = true;

            renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            renderer.xr.enabled = true;

            container.appendChild(renderer.domElement);

            // WebXR Button Integration

            document.body.appendChild(VRButton.createButton(renderer));

            const nativeVRBtn = document.getElementById('VRButton');

            if (nativeVRBtn) nativeVRBtn.style.display = 'none';

            // 4. Orbit Controls (Desktop mouse camera)

            controls = new OrbitControls(camera, renderer.domElement);

            controls.enableDamping = true;

            controls.dampingFactor = 0.05;

            controls.target.set(0, 1.1, -0.4);

            controls.maxPolarAngle = Math.PI / 2 + 0.05;

            // 5. Realistic Laboratory Lighting Setup

            const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);

            scene.add(ambientLight);

            const ceilingLight = new THREE.SpotLight(0xffffff, 3.5);

            ceilingLight.position.set(0, 4.5, 0);

            ceilingLight.angle = Math.PI / 3;

            ceilingLight.penumbra = 0.5;

            ceilingLight.castShadow = true;

            scene.add(ceilingLight);

            const benchLight = new THREE.DirectionalLight(0x38bdf8, 1.5);

            benchLight.position.set(2, 3, 2);

            scene.add(benchLight);

            // 6. Build Realistic Lab Room & Metallic Optical Breadboard

            buildLabEnvironment();

            // 7. Build 8 Precise Optical Instruments matching diagram layout

            build8LaboratoryInstruments();

            // 8. Connect Instruments with Optical Patch Cords

            createPatchCords();

            // 9. Light Pulse Propagation Group

            pulseGroup = new THREE.Group();

            scene.add(pulseGroup);

            resetLightPulses();

            // 10. WebXR VR Controllers & Interaction Setup

            setupWebXRControllers();

            // 11. Desktop Mouse Grab Interaction

            setupDesktopMouseGrab();

            // 12. Bind UI Events & Resize Handlers

            bindUIEvents();

            window.addEventListener('resize', onWindowResize);

            // Run Initial Physics Calculation

            calculatePhysicsResults();

        }

        // --- 1. Laboratory Environment & Metallic Breadboard Table ---

        function buildLabEnvironment() {

            roomGroup = new THREE.Group();

            scene.add(roomGroup);

            // Tiled Flooring

            const floorGeo = new THREE.PlaneGeometry(12, 12);

            const floorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.2 });

            const floor = new THREE.Mesh(floorGeo, floorMat);

            floor.rotation.x = -Math.PI / 2;

            floor.receiveShadow = true;

            roomGroup.add(floor);

            // Walls

            const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b1329, roughness: 0.9 });

            const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);

            backWall.position.set(0, 3, -4);

            roomGroup.add(backWall);

            // Wall Reference Charts (Matching Image Posters)

            createPoster("Optical Communication System", "Tx (Laser) -> Modulator -> Fiber -> Rx (Photodetector)", -2.8, 3.5, -3.95);

            createPoster("Chromatic Dispersion", "Pulse broadening with wavelength λ", 0.0, 3.5, -3.95);

            createPoster("Polarization Mode Dispersion (PMD)", "Pulse spreading due to orthogonal PMD axes", 2.8, 3.5, -3.95);

            // Heavy Worktable Base

            const tableBaseGeo = new THREE.BoxGeometry(4.2, 0.85, 1.4);

            const tableBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });

            const tableBase = new THREE.Mesh(tableBaseGeo, tableBaseMat);

            tableBase.position.set(0, 0.425, -0.4);

            roomGroup.add(tableBase);

            // METALLIC OPTICAL BREADBOARD (Dark anodized aluminum with matrix grid hole pattern)

            const bbGeo = new THREE.BoxGeometry(4.0, 0.08, 1.2);

            const bbMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.85, roughness: 0.25 });

            breadboardMesh = new THREE.Mesh(bbGeo, bbMat);

            breadboardMesh.position.set(0, 0.89, -0.4);

            breadboardMesh.receiveShadow = true;

            breadboardMesh.castShadow = true;

            roomGroup.add(breadboardMesh);

            // Add Breadboard Threaded Hole Texture Details

            const canvas = document.createElement('canvas');

            canvas.width = 512; canvas.height = 512;

            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#222a38'; ctx.fillRect(0, 0, 512, 512);

            ctx.fillStyle = '#0f172a';

            for (let x = 16; x < 512; x += 32) {

                for (let y = 16; y < 512; y += 32) {

                    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();

                }

            }

            const bbTex = new THREE.CanvasTexture(canvas);

            bbTex.wrapS = THREE.RepeatWrapping; bbTex.wrapT = THREE.RepeatWrapping;

            bbTex.repeat.set(8, 2.5);

            bbMat.map = bbTex;

        }

        function createPoster(title, subtitle, x, y, z) {

            const canvas = document.createElement('canvas');

            canvas.width = 512; canvas.height = 256;

            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 256);

            ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 492, 236);

            ctx.fillStyle = '#0369a1'; ctx.font = 'bold 22px Segoe UI'; ctx.textAlign = 'center';

            ctx.fillText(title, 256, 45);

            ctx.fillStyle = '#334155'; ctx.font = '16px Segoe UI';

            ctx.fillText(subtitle, 256, 85);

            // Draw schematic curve

            ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3; ctx.beginPath();

            for (let i = 40; i < 470; i += 5) {

                const yPos = 180 - Math.exp(-Math.pow((i - 256) / 80, 2)) * 70;

                if (i === 40) ctx.moveTo(i, yPos); else ctx.lineTo(i, yPos);

            }

            ctx.stroke();

            const texture = new THREE.CanvasTexture(canvas);

            const posterMesh = new THREE.Mesh(

                new THREE.PlaneGeometry(1.8, 0.9),

                new THREE.MeshBasicMaterial({ map: texture })

            );

            posterMesh.position.set(x, y, z);

            roomGroup.add(posterMesh);

        }

        // --- 2. Build 8 Precise Optical Instruments (Matching Laboratory Diagram) ---

        function build8LaboratoryInstruments() {

            labInstruments = [];

            // 1. DFB LASER SOURCE (Stacked Bottom Left - Dark Chassis with Blue LCD Display)

            const laserGroup = createInstrumentGroup("Laser Source (DFB)", -1.5, 0.98, -0.5, 0.45, 0.14, 0.4, 0x1e293b);

            laserTexture = createDynamicScreenTexture(256, 128, (ctx) => { laserCtx = ctx; });

            const laserScreen = new THREE.Mesh(

                new THREE.PlaneGeometry(0.25, 0.08),

                new THREE.MeshBasicMaterial({ map: laserTexture })

            );

            laserScreen.position.set(-0.06, 0.0, 0.201);

            laserGroup.add(laserScreen);

            // 2. FUNCTION / PULSE GENERATOR (Stacked Top Left - Silver/Grey Chassis with Live Pulse Screen)

            const funcGenGroup = createInstrumentGroup("Function Generator", -1.5, 1.15, -0.5, 0.45, 0.18, 0.38, 0xd1d5db);

            funcGenTexture = createDynamicScreenTexture(256, 160, (ctx) => { funcGenCtx = ctx; });

            const funcGenScreen = new THREE.Mesh(

                new THREE.PlaneGeometry(0.18, 0.11),

                new THREE.MeshBasicMaterial({ map: funcGenTexture })

            );

            funcGenScreen.position.set(-0.11, 0.01, 0.191);

            funcGenGroup.add(funcGenScreen);

            // 3. OPTICAL MODULATOR (MZM - Black Anodized Aluminium Box on Post)

            const mzmGroup = createInstrumentGroup("Optical Modulator (MZM)", -0.9, 0.98, -0.5, 0.22, 0.12, 0.22, 0x0f172a);

            addGoldBNCConnectors(mzmGroup);

            // 4. SINGLE MODE FIBER SPOOL (Bright Yellow Fiber Coil Mounted on Black Metal Flanges)

            const spoolGroup = new THREE.Group();

            spoolGroup.name = "Single Mode Fiber Spool";

            spoolGroup.position.set(-0.4, 1.05, -0.5);

            const flangeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });

            const topFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32), flangeMat);

            topFlange.position.y = 0.1;

            const botFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32), flangeMat);

            botFlange.position.y = -0.1;

            const spoolCoil = new THREE.Mesh(

                new THREE.CylinderGeometry(0.16, 0.16, 0.18, 32),

                new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 }) // Bright Yellow Fiber

            );

            spoolCoil.name = "CoilMesh";

            spoolGroup.add(topFlange); spoolGroup.add(botFlange); spoolGroup.add(spoolCoil);

            makeInstrumentGrabbable(spoolGroup, "Single Mode Fiber Spool");

            // 5. POLARIZATION CONTROLLER (Dual Black Block with 3 Rotatable Paddles)

            const polGroup = createInstrumentGroup("Polarization Controller", 0.2, 0.98, -0.5, 0.32, 0.09, 0.16, 0x1e293b);

            for (let i = -1; i <= 1; i++) {

                const paddle = new THREE.Mesh(

                    new THREE.TorusGeometry(0.035, 0.008, 16, 32),

                    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 })

                );

                paddle.position.set(i * 0.08, 0.08, 0);

                paddle.rotation.y = Math.PI / 4;

                polGroup.add(paddle);

            }

            // 6. PHOTODETECTOR (Optical-to-Electrical Converter Module)

            const pdGroup = createInstrumentGroup("Photodetector", 0.7, 0.98, -0.5, 0.16, 0.11, 0.16, 0x0f172a);

            // 7. DIGITAL STORAGE OSCILLOSCOPE (Grey Mainframe with Active Dynamic Eye Diagram LCD)

            const scopeGroup = createInstrumentGroup("Oscilloscope", 1.15, 1.12, -0.5, 0.48, 0.32, 0.32, 0xe2e8f0);

            scopeTexture = createDynamicScreenTexture(256, 256, (ctx) => { scopeCtx = ctx; });

            const scopeScreen = new THREE.Mesh(

                new THREE.PlaneGeometry(0.28, 0.20),

                new THREE.MeshBasicMaterial({ map: scopeTexture })

            );

            scopeScreen.position.set(-0.06, 0.03, 0.161);

            scopeGroup.add(scopeScreen);

            // 8. COMPUTER (Analysis & Data Processing Monitor + Keyboard + Mouse)

            const compGroup = createInstrumentGroup("Computer Monitor", 1.65, 1.18, -0.4, 0.48, 0.36, 0.08, 0x0f172a);

            compTexture = createDynamicScreenTexture(512, 256, (ctx) => { compCtx = ctx; });

            const compScreen = new THREE.Mesh(

                new THREE.PlaneGeometry(0.44, 0.26),

                new THREE.MeshBasicMaterial({ map: compTexture })

            );

            compScreen.position.set(0, 0.02, 0.042);

            compGroup.add(compScreen);

            // Keyboard & Mouse Accessories

            const kbMesh = new THREE.Mesh(

                new THREE.BoxGeometry(0.35, 0.015, 0.14),

                new THREE.MeshStandardMaterial({ color: 0x1e293b })

            );

            kbMesh.position.set(1.65, 0.94, -0.15);

            scene.add(kbMesh);

        }

        function createInstrumentGroup(name, x, y, z, w, h, d, color) {

            const group = new THREE.Group();

            group.position.set(x, y, z);

            const body = new THREE.Mesh(

                new THREE.BoxGeometry(w, h, d),

                new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 })

            );

            body.castShadow = true; body.receiveShadow = true;

            group.add(body);

            makeInstrumentGrabbable(group, name);

            return group;

        }

        function addGoldBNCConnectors(group) {

            const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });

            const bnc1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04), goldMat);

            bnc1.rotation.z = Math.PI / 2; bnc1.position.set(-0.12, 0, 0);

            const bnc2 = bnc1.clone(); bnc2.position.set(0.12, 0, 0);

            group.add(bnc1); group.add(bnc2);

        }

        function createDynamicScreenTexture(w, h, callback) {

            const canvas = document.createElement('canvas');

            canvas.width = w; canvas.height = h;

            const ctx = canvas.getContext('2d');

            callback(ctx);

            return new THREE.CanvasTexture(canvas);

        }

        function makeInstrumentGrabbable(group, name) {

            group.name = name;

            group.userData = { isGrabbable: true, originalY: group.position.y };

            scene.add(group);

            labInstruments.push(group);

        }

        // --- 3. Optical Patch Cords ---

        function createPatchCords() {

            patchCords = [];

            for (let i = 0; i < labInstruments.length - 1; i++) {

                const cordMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 3 }); // Yellow Patch Cord

                const cordGeo = new THREE.BufferGeometry();

                const cord = new THREE.Line(cordGeo, cordMat);

                scene.add(cord);

                patchCords.push({ line: cord, from: labInstruments[i], to: labInstruments[i + 1] });

            }

            updatePatchCords();

        }

        function updatePatchCords() {

            patchCords.forEach((pc) => {

                if (!pc.from || !pc.to) return;

                const p1 = pc.from.position;

                const p2 = pc.to.position;

                const points = [];

                const steps = 12;

                for (let i = 0; i <= steps; i++) {

                    const t = i / steps;

                    const x = THREE.MathUtils.lerp(p1.x, p2.x, t);

                    const z = THREE.MathUtils.lerp(p1.z, p2.z, t);

                    const y = THREE.MathUtils.lerp(p1.y, p2.y, t) - Math.sin(t * Math.PI) * 0.08;

                    points.push(new THREE.Vector3(x, y, z));

                }

                pc.line.geometry.setFromPoints(points);

            });

        }

        // --- 4. Light Pulse Waves ---

        function resetLightPulses() {

            while (pulseGroup.children.length > 0) {

                const child = pulseGroup.children[0];

                if (child.geometry) child.geometry.dispose();

                if (child.material) child.material.dispose();

                pulseGroup.remove(child);

            }

            const mainPulse = new THREE.Mesh(

                new THREE.SphereGeometry(0.03, 16, 16),

                new THREE.MeshBasicMaterial({ color: 0x00ffff })

            );

            mainPulse.position.set(-1.5, 0.98, -0.5);

            const pmdPulse = new THREE.Mesh(

                new THREE.SphereGeometry(0.025, 16, 16),

                new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.8 })

            );

            pmdPulse.position.set(-1.5, 0.98, -0.5);

            pulseGroup.add(mainPulse);

            pulseGroup.add(pmdPulse);

            state.pulsePos = -1.5;

        }

        // --- 5. WebXR Controllers Setup ---

        function setupWebXRControllers() {

            raycaster = new THREE.Raycaster();

            tempMatrix = new THREE.Matrix4();

            controller1 = renderer.xr.getController(0);

            controller1.addEventListener('selectstart', onGrabStart);

            controller1.addEventListener('selectend', onGrabEnd);

            controller1.addEventListener('squeezestart', onGrabStart);

            controller1.addEventListener('squeezeend', onGrabEnd);

            scene.add(controller1);

            controller2 = renderer.xr.getController(1);

            controller2.addEventListener('selectstart', onGrabStart);

            controller2.addEventListener('selectend', onGrabEnd);

            controller2.addEventListener('squeezestart', onGrabStart);

            controller2.addEventListener('squeezeend', onGrabEnd);

            scene.add(controller2);

            const controllerModelFactory = new XRControllerModelFactory();

            controllerGrip1 = renderer.xr.getControllerGrip(0);

            controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));

            scene.add(controllerGrip1);

            controllerGrip2 = renderer.xr.getControllerGrip(1);

            controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));

            scene.add(controllerGrip2);

            // Laser Beam for Controller Pointer

            const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]);

            const laserMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, opacity: 0.6, transparent: true });

            controller1.add(new THREE.Line(laserGeo, laserMat));

            controller2.add(new THREE.Line(laserGeo, laserMat));

        }

        function onGrabStart(event) {

            const controller = event.target;

            const intersections = getControllerIntersections(controller);

            if (intersections.length > 0) {

                const object = intersections[0].object.parent;

                if (object && object.userData.isGrabbable) {

                    grabbedObject = object;

                    controller.attach(grabbedObject);

                    showToast(`VR Grabbed: ${object.name}`);

                }

            }

        }

        function onGrabEnd(event) {

            if (grabbedObject) {

                scene.attach(grabbedObject);

                grabbedObject.position.y = Math.max(0.94, grabbedObject.position.y);

                showToast(`Placed ${grabbedObject.name}`);

                grabbedObject = null;

            }

        }

        function getControllerIntersections(controller) {

            tempMatrix.identity().extractRotation(controller.matrixWorld);

            raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);

            raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

            const meshes = [];

            labInstruments.forEach((inst) => inst.traverse((c) => { if (c.isMesh) meshes.push(c); }));

            return raycaster.intersectObjects(meshes, false);

        }

        // --- 6. Desktop Mouse Drag Fallback ---

        function setupDesktopMouseGrab() {

            mouse = new THREE.Vector2();

            mouseRaycaster = new THREE.Raycaster();

            mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.98);

            window.addEventListener('mousedown', (e) => {

                if (e.target.tagName !== 'CANVAS') return;

                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;

                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

                mouseRaycaster.setFromCamera(mouse, camera);

                const meshes = [];

                labInstruments.forEach((inst) => inst.traverse((c) => { if (c.isMesh) meshes.push(c); }));

                const intersects = mouseRaycaster.intersectObjects(meshes, false);

                if (intersects.length > 0) {

                    desktopDraggedObject = intersects[0].object.parent;

                    controls.enabled = false;

                }

            });

            window.addEventListener('mousemove', (e) => {

                if (!desktopDraggedObject) return;

                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;

                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

                mouseRaycaster.setFromCamera(mouse, camera);

                const targetPoint = new THREE.Vector3();

                mouseRaycaster.ray.intersectPlane(mousePlane, targetPoint);

                if (targetPoint) {

                    desktopDraggedObject.position.x = THREE.MathUtils.clamp(targetPoint.x, -1.8, 1.8);

                    desktopDraggedObject.position.z = THREE.MathUtils.clamp(targetPoint.z, -0.9, 0.1);

                    updatePatchCords();

                }

            });

            window.addEventListener('mouseup', () => {

                if (desktopDraggedObject) {

                    desktopDraggedObject = null;

                    controls.enabled = true;

                }

            });

        }

        // --- 7. Physics Calculation Engine ---

        function calculatePhysicsResults() {

            const L = state.fiberLength;         // km

            const B = state.dataRate;            // Gb/s

            const lambda = state.wavelength;     // nm

            const phi = state.polAngle;          // deg

            // Chromatic dispersion parameter D(λ)

            const D = 0.05 * (lambda - 1310);

            state.dispersionD = D;

            // Broadening calculations

            const cdBroadening = Math.abs(D) * L * state.laserLinewidth; // ps

            const polRad = (phi * Math.PI) / 180;

            const pmdDGD = state.pmdDgdCoeff * Math.sqrt(L) * Math.sin(2 * polRad); // ps

            const totalBroadening = Math.sqrt(Math.pow(cdBroadening, 2) + Math.pow(pmdDGD, 2));

            const bitPeriodPs = 1000 / B;

            const eyePenaltyDb = 5 * Math.log10(1 + Math.pow(totalBroadening / bitPeriodPs, 2));

            // Dynamic Sidebar Readout Update

            const resultsPanel = document.getElementById('results-panel');

            resultsPanel.innerHTML = `

                <div class="text-cyan-300 font-bold border-b border-slate-800 pb-1 mb-1">Physics Analysis Results</div>

                <div class="flex justify-between"><span>Dispersion D(λ):</span> <span class="text-amber-300">${D.toFixed(2)} ps/(nm·km)</span></div>

                <div class="flex justify-between"><span>CD Delay (Δt_CD):</span> <span class="text-amber-300">${cdBroadening.toFixed(2)} ps</span></div>

                <div class="flex justify-between"><span>PMD Delay (Δt_PMD):</span> <span class="text-amber-300">${pmdDGD.toFixed(2)} ps</span></div>

                <div class="flex justify-between"><span>Total Pulse Broadening:</span> <span class="text-cyan-300 font-bold">${totalBroadening.toFixed(2)} ps</span></div>

                <div class="flex justify-between"><span>Eye Opening Penalty:</span> <span class="${eyePenaltyDb > 2.0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}">${eyePenaltyDb.toFixed(2)} dB</span></div>

            `;

            // Dynamic Fiber Spool Scale Update

            const spoolGroup = labInstruments.find(i => i.name === "Single Mode Fiber Spool");

            if (spoolGroup) {

                const spoolCoil = spoolGroup.getObjectByName("CoilMesh");

                if (spoolCoil) {

                    const scaleFactor = 0.5 + (L / 100) * 0.6;

                    spoolCoil.scale.set(scaleFactor, 1, scaleFactor);

                }

            }

            // Update Dynamic Instrument LCD Displays

            updateLaserLCD();

            updateFunctionGenScreen();

            updateOscilloscopeScreen(totalBroadening, bitPeriodPs);

            updateComputerScreen(D, L, pmdDGD);

            showToast("Calculated dispersion & updated instrument screens!");

        }

        // Live DFB Laser LCD Display

        function updateLaserLCD() {

            if (!laserCtx) return;

            laserCtx.fillStyle = '#0284c7'; laserCtx.fillRect(0, 0, 256, 128);

            laserCtx.fillStyle = '#ffffff'; laserCtx.font = 'bold 26px monospace';

            laserCtx.fillText(`${state.wavelength}.00 nm`, 15, 50);

            laserCtx.fillText(`5.00 dBm`, 15, 95);

            if (laserTexture) laserTexture.needsUpdate = true;

        }

        // Live Function Generator LCD Display

        function updateFunctionGenScreen() {

            if (!funcGenCtx) return;

            funcGenCtx.fillStyle = '#0f172a'; funcGenCtx.fillRect(0, 0, 256, 160);

            funcGenCtx.strokeStyle = '#38bdf8'; funcGenCtx.lineWidth = 3;

            funcGenCtx.beginPath();

            const freq = state.dataRate / 4;

            for (let x = 0; x < 256; x++) {

                const y = 80 + (Math.sin(x * 0.1 * freq) > 0 ? -35 : 35);

                if (x === 0) funcGenCtx.moveTo(x, y); else funcGenCtx.lineTo(x, y);

            }

            funcGenCtx.stroke();

            funcGenCtx.fillStyle = '#38bdf8'; funcGenCtx.font = 'bold 16px monospace';

            funcGenCtx.fillText(`PULSE: ${state.dataRate} Gb/s`, 10, 25);

            if (funcGenTexture) funcGenTexture.needsUpdate = true;

        }

        // Live Oscilloscope Eye Diagram Screen

        function updateOscilloscopeScreen(broadening, bitPeriod) {

            if (!scopeCtx) return;

            scopeCtx.fillStyle = '#021814'; scopeCtx.fillRect(0, 0, 256, 256);

            // Oscilloscope Grid

            scopeCtx.strokeStyle = '#054433'; scopeCtx.lineWidth = 1;

            for (let i = 0; i < 256; i += 32) {

                scopeCtx.beginPath(); scopeCtx.moveTo(i, 0); scopeCtx.lineTo(i, 256); scopeCtx.stroke();

                scopeCtx.beginPath(); scopeCtx.moveTo(0, i); scopeCtx.lineTo(256, i); scopeCtx.stroke();

            }

            // Draw Dynamic Eye Opening Waveform

            scopeCtx.strokeStyle = '#facc15'; scopeCtx.lineWidth = 2;

            const closure = Math.min(90, (broadening / bitPeriod) * 75);

            for (let k = 0; k < 3; k++) {

                scopeCtx.beginPath();

                for (let x = 0; x < 256; x += 4) {

                    const y = 128 + Math.sin((x / 24) + k) * (80 - closure);

                    if (x === 0) scopeCtx.moveTo(x, y); else scopeCtx.lineTo(x, y);

                }

                scopeCtx.stroke();

            }

            scopeCtx.fillStyle = '#00ffcc'; scopeCtx.font = 'bold 12px monospace';

            scopeCtx.fillText(`EYE DIAGRAM (${state.dataRate} Gb/s)`, 10, 20);

            if (scopeTexture) scopeTexture.needsUpdate = true;

        }

        // Live Computer Dual Analysis Display

        function updateComputerScreen(D, L, pmdDGD) {

            if (!compCtx) return;

            compCtx.fillStyle = '#0f172a'; compCtx.fillRect(0, 0, 512, 256);

            // Left Plot: Chromatic Dispersion

            compCtx.fillStyle = '#38bdf8'; compCtx.font = 'bold 16px Segoe UI';

            compCtx.fillText('Chromatic Dispersion', 30, 30);

            compCtx.strokeStyle = '#0284c7'; compCtx.lineWidth = 2;

            compCtx.beginPath(); compCtx.moveTo(30, 220); compCtx.lineTo(220, 220); compCtx.moveTo(30, 220); compCtx.lineTo(30, 50); compCtx.stroke();

            compCtx.strokeStyle = '#eab308'; compCtx.lineWidth = 3;

            compCtx.beginPath();

            for (let x = 30; x <= 220; x += 5) {

                const lam = 1310 + (x - 30) * 1.8;

                const dVal = 0.05 * (lam - 1310);

                const y = 220 - dVal * 8;

                if (x === 30) compCtx.moveTo(x, y); else compCtx.lineTo(x, y);

            }

            compCtx.stroke();

            // Right Plot: PMD Analysis

            compCtx.fillStyle = '#38bdf8';

            compCtx.fillText('PMD Delay Analysis', 280, 30);

            compCtx.strokeStyle = '#0284c7'; compCtx.lineWidth = 2;

            compCtx.beginPath(); compCtx.moveTo(280, 220); compCtx.lineTo(480, 220); compCtx.moveTo(280, 220); compCtx.lineTo(280, 50); compCtx.stroke();

            compCtx.strokeStyle = '#ef4444'; compCtx.lineWidth = 3;

            compCtx.beginPath();

            for (let x = 280; x <= 480; x += 5) {

                const pDeg = (x - 280) * (90 / 200);

                const pRad = (pDeg * Math.PI) / 180;

                const dgd = state.pmdDgdCoeff * Math.sqrt(L) * Math.sin(2 * pRad);

                const y = 220 - dgd * 12;

                if (x === 280) compCtx.moveTo(x, y); else compCtx.lineTo(x, y);

            }

            compCtx.stroke();

            if (compTexture) compTexture.needsUpdate = true;

        }

        // --- 8. WebXR & Fallback VR Modes ---

        function toggleVRMode() {

            if ('xr' in navigator) {

                navigator.xr.isSessionSupported('immersive-vr').then((supported) => {

                    if (supported) {

                        navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] })

                        .then((session) => {

                            renderer.xr.setSession(session);

                            showToast("Entering WebXR Immersive VR Session...");

                        }).catch(() => { enableFallbackVR(); });

                    } else { enableFallbackVR(); }

                }).catch(() => { enableFallbackVR(); });

            } else { enableFallbackVR(); }

        }

        function enableFallbackVR() {

            state.isVRFallbackMode = !state.isVRFallbackMode;

            const divider = document.getElementById('vr-split-divider');

            if (state.isVRFallbackMode) {

                divider.classList.remove('hidden');

                camera.position.set(0, 1.3, 0.8);

                controls.target.set(0, 1.1, -0.4);

                showToast("Stereoscopic Desktop VR Mode Active");

            } else {

                divider.classList.add('hidden');

                renderer.setScissorTest(false);

                renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);

                camera.aspect = window.innerWidth / window.innerHeight;

                camera.updateProjectionMatrix();

                showToast("Exited VR Mode.");

            }

        }

        function showToast(msg) {

            const toast = document.getElementById('toast');

            document.getElementById('toast-msg').innerText = msg;

            toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');

            setTimeout(() => {

                toast.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');

            }, 3000);

        }

        // --- 9. UI Binding & Animation Loop ---

        function bindUIEvents() {

            document.getElementById('slider-length').addEventListener('input', (e) => {

                state.fiberLength = parseFloat(e.target.value);

                document.getElementById('label-length').innerText = `Fiber Length: ${state.fiberLength} km`;

            });

            document.getElementById('slider-datarate').addEventListener('input', (e) => {

                state.dataRate = parseFloat(e.target.value);

                document.getElementById('label-datarate').innerText = `Data Rate: ${state.dataRate} Gb/s`;

            });

            document.getElementById('slider-wavelength').addEventListener('input', (e) => {

                state.wavelength = parseFloat(e.target.value);

                document.getElementById('label-wavelength').innerText = `Wavelength: ${state.wavelength} nm`;

            });

            document.getElementById('slider-polangle').addEventListener('input', (e) => {

                state.polAngle = parseFloat(e.target.value);

                document.getElementById('label-polangle').innerText = `Polarization Angle: ${state.polAngle}°`;

            });

            document.getElementById('btn-pause').addEventListener('click', () => {

                state.isPaused = !state.isPaused;

                document.getElementById('btn-pause').innerText = state.isPaused ? "Play Pulse" : "Pause Pulse";

            });

            document.getElementById('btn-reset').addEventListener('click', () => {

                resetLightPulses();

                showToast("Laboratory bench reset");

            });

            document.getElementById('btn-zoom-in').addEventListener('click', () => camera.position.multiplyScalar(0.85));

            document.getElementById('btn-zoom-out').addEventListener('click', () => camera.position.multiplyScalar(1.15));

            document.getElementById('btn-rot-left').addEventListener('click', () => rotateCamera(0.2));

            document.getElementById('btn-rot-right').addEventListener('click', () => rotateCamera(-0.2));

            document.getElementById('btn-calc').addEventListener('click', calculatePhysicsResults);

            document.getElementById('btn-vr').addEventListener('click', toggleVRMode);

        }

        function rotateCamera(angle) {

            const x = camera.position.x;

            const z = camera.position.z;

            camera.position.x = x * Math.cos(angle) - z * Math.sin(angle);

            camera.position.z = x * Math.sin(angle) + z * Math.cos(angle);

            camera.lookAt(0, 1.1, -0.4);

        }

        function onWindowResize() {

            camera.aspect = window.innerWidth / window.innerHeight;

            camera.updateProjectionMatrix();

            renderer.setSize(window.innerWidth, window.innerHeight);

        }

        function animate() {

            renderer.setAnimationLoop(render);

        }

        function render() {

            if (!state.isPaused && pulseGroup.children.length >= 2) {

                state.pulsePos += 0.012;

                if (state.pulsePos > 1.6) state.pulsePos = -1.5;

                const p1 = pulseGroup.children[0];

                const p2 = pulseGroup.children[1];

                p1.position.x = state.pulsePos;

                const cdBroadening = Math.abs(state.dispersionD) * state.fiberLength * state.laserLinewidth;

                const spread = (cdBroadening / 100) * ((state.pulsePos + 1.5) / 3.1);

                p2.position.x = state.pulsePos - spread;

                const scale = 1 + spread * 3;

                p1.scale.set(scale, scale, scale);

                p2.scale.set(scale * 0.8, scale * 0.8, scale * 0.8);

            }

            updatePatchCords();

            controls.update();

            if (state.isVRFallbackMode) {

                const w = window.innerWidth;

                const h = window.innerHeight;

                const halfW = w / 2;

                renderer.setScissorTest(true);

                // Left Eye

                renderer.setScissor(0, 0, halfW, h);

                renderer.setViewport(0, 0, halfW, h);

                camera.aspect = halfW / h;

                camera.position.x -= 0.03;

                camera.updateProjectionMatrix();

                renderer.render(scene, camera);

                // Right Eye

                renderer.setScissor(halfW, 0, halfW, h);

                renderer.setViewport(halfW, 0, halfW, h);

                camera.position.x += 0.06;

                camera.updateProjectionMatrix();

                renderer.render(scene, camera);

                camera.position.x -= 0.03;

            } else {

                renderer.setScissorTest(false);

                renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);

                renderer.render(scene, camera);

            }

        }



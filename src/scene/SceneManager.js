import * as THREE from 'three';
import { Sculpture } from './Sculpture.js';

export class SceneManager {
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {Function} [options.onFPSUpdate]
   * @param {Function} [options.onWebGLError]
   * @param {Function} [options.onFirstDrag]
   */
  constructor({ canvas, onFPSUpdate = null, onWebGLError = null, onFirstDrag = null, onMotion = null } = {}) {
    this.canvas = canvas;
    this.onFPSUpdate = onFPSUpdate;
    this.onWebGLError = onWebGLError;
    this.onFirstDrag = onFirstDrag;
    this.onMotion = onMotion;

    this.isRunning = false;
    this.animationFrameId = null;
    this.clock = new THREE.Clock();

    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60;
    this.frameTimes = [];
    this.maxFrameSamples = 180;
    this.metrics = {
      avgFps: 60,
      p50: 16.6,
      p95: 16.9,
      p99: 17.4,
      drawCalls: 0,
      triangles: 0
    };

    // Direct manipulation drag & inertia state
    this.drag = {
      isDown: false,
      hasDragged: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      lastTime: 0,
      vx: 0,
      vy: 0,
      pointerId: null,
      isTouch: false,
      history: []
    };
    this.dragSensitivity = (Math.PI / Math.min(window.innerWidth || 1440, 1600)) * 1.5;

    // Expose instance for telemetry and performance inspections
    if (typeof window !== 'undefined') {
      window.__afterlight_scene = this;
    }

    // Camera target vectors
    const initCamZ = this.isMobile ? 9.0 : (this.isTablet ? 8.4 : 7.6);
    this.cameraCurrentPos = new THREE.Vector3(0, 0, initCamZ);
    this.cameraTargetPos = new THREE.Vector3(0, 0, initCamZ);
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);
    this.cameraCurrentLook = new THREE.Vector3(0, 0, 0);
    this.cameraPointerOffset = new THREE.Vector3(0, 0, 0);
    this._tempTargetPos = new THREE.Vector3();
    this._cachedRotAngles = { yaw: 0, pitch: 0 };

    // Dynamic cinematic lighting targets
    this.lightingTargets = {
      keyIntensity: 2.0,
      rimIntensity: 3.4,
      coreIntensity: 1.8,
      rimColor: new THREE.Color(0x4f75ff),
      coreColor: new THREE.Color(0x608eff)
    };

    // Sculpture horizontal framing offset
    this.sculptureTargetX = this.isMobile ? 0 : (this.isTablet ? 0.62 : 1.25);
    this.sculptureCurrentX = this.sculptureTargetX;
    this.sculptureTargetY = 0;
    this.sculptureCurrentY = 0;

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!this.checkWebGL()) {
      if (this.onWebGLError) {
        this.onWebGLError();
      }
      return;
    }

    this.init();
    this.bindEvents();
    this.start();
  }

  checkWebGL() {
    try {
      const testCanvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width <= 1080;
    this.isDesktop = width > 1080;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const initialZ = this.isMobile ? 9.2 : this.isTablet ? 8.6 : 7.8;
    this.cameraTargetPos.set(0, 0, initialZ);
    this.cameraLookTarget.set(0, 0, 0);
    this.cameraCurrentPos.copy(this.cameraTargetPos);
    this.cameraCurrentLook.copy(this.cameraLookTarget);
    this.camera.position.copy(this.cameraCurrentPos);

    this.sculptureTargetX = this.isMobile ? 0 : this.isTablet ? 0.65 : 1.25;
    this.sculptureCurrentX = this.sculptureTargetX;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.adaptiveDpr = this.dpr;
    this.lowFpsCount = 0;
    this.highFpsCount = 0;
    this.isContextLost = false;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    } catch (err) {
      console.error('[AFTERLIGHT WebGL] Renderer creation failed:', err);
      if (this.onWebGLError) this.onWebGLError();
      return;
    }

    // Listen to WebGL context lifecycle events
    this.handleContextLost = (e) => {
      e.preventDefault();
      console.warn('[AFTERLIGHT WebGL] Context lost. Pausing render loop.');
      this.isContextLost = true;
      this.stop();
      const banner = document.querySelector('#context-lost-banner');
      if (banner) banner.style.display = 'block';
    };
    this.handleContextRestored = () => {
      console.info('[AFTERLIGHT WebGL] Context restored. Rebuilding scene resources...');
      this.isContextLost = false;
      const banner = document.querySelector('#context-lost-banner');
      if (banner) banner.style.display = 'none';
      try {
        if (this.renderer) {
          this.renderer.resetState();
          this.setupEnvironment();
          if (this.sculpture) {
            this.sculpture.dispose();
            this.scene.remove(this.sculpture.group);
            this.sculpture = new Sculpture({
              pixelRatio: this.adaptiveDpr || this.dpr,
              isMobile: this.isMobile
            });
            this.scene.add(this.sculpture.group);
          }
          this.renderer.compile(this.scene, this.camera);
        }
        this.start();
      } catch (err) {
        console.error('[AFTERLIGHT WebGL] Failed to recover from context restoration:', err);
        if (this.onWebGLError) this.onWebGLError();
      }
    };
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.setupEnvironment();
    this.setupLighting();

    this.sculpture = new Sculpture({
      pixelRatio: this.dpr,
      isMobile: this.isMobile
    });
    this.scene.add(this.sculpture.group);

    if (this.prefersReducedMotion) {
      this.sculpture.baseRotationSpeed = 0.02;
    }

    // Pre-warm WebGL shader pipelines to prevent frame drops during runtime
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch (e) {
      console.warn('[AFTERLIGHT] Pre-compile notice:', e);
    }
  }

  setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradTop = ctx.createRadialGradient(512, 100, 10, 512, 100, 340);
    gradTop.addColorStop(0, '#ffffff');
    gradTop.addColorStop(0.35, '#c8d8f8');
    gradTop.addColorStop(1, 'transparent');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradSide = ctx.createRadialGradient(180, 260, 20, 180, 260, 280);
    gradSide.addColorStop(0, '#4f75ff');
    gradSide.addColorStop(0.5, '#1e2b66');
    gradSide.addColorStop(1, 'transparent');
    ctx.fillStyle = gradSide;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradRim = ctx.createRadialGradient(840, 360, 10, 840, 360, 240);
    gradRim.addColorStop(0, '#f2e8d5');
    gradRim.addColorStop(0.5, '#403024');
    gradRim.addColorStop(1, 'transparent');
    ctx.fillStyle = gradRim;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.envMap = pmremGenerator.fromEquirectangular(texture).texture;
    this.scene.environment = this.envMap;

    pmremGenerator.dispose();
    texture.dispose();
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x0a0c12, 0.85);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xf4f3f0, 2.0);
    this.keyLight.position.set(5, 7, 5);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x4f75ff, 3.4);
    this.rimLight.position.set(-6, -4, -6);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0x7688b5, 0.9);
    this.fillLight.position.set(-4, 3, 4);
    this.scene.add(this.fillLight);

    this.bounceLight = new THREE.DirectionalLight(0x182440, 0.45);
    this.bounceLight.position.set(0, -5, 2);
    this.scene.add(this.bounceLight);

    this.corePointLight = new THREE.PointLight(0x608eff, 1.8, 8.0);
    this.corePointLight.position.set(0, 0, 0);
    this.scene.add(this.corePointLight);
  }

  bindEvents() {
    this.handleResize = this.onResize.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handlePointerCancel = this.onPointerCancel.bind(this);
    this.handleClickCapture = this.onClickCapture.bind(this);
    this.handleVisibilityChange = this.onVisibilityChange.bind(this);

    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', this.handlePointerCancel, { passive: true });
    window.addEventListener('click', this.handleClickCapture, { capture: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.handleMotionChange = (e) => {
      this.prefersReducedMotion = e.matches;
      if (this.sculpture) {
        this.sculpture.baseRotationSpeed = this.prefersReducedMotion ? 0.02 : 0.07;
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', this.handleMotionChange);
    }
  }

  onResize() {
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = requestAnimationFrame(() => {
      this._applyResize();
      this.resizeRaf = null;
    });
  }

  _applyResize() {
    if (!this.renderer || !this.camera) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width <= 1080;
    this.isDesktop = width > 1080;
    this.dragSensitivity = (Math.PI / Math.min(width || 1440, 1600)) * 1.5;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.adaptiveDpr = Math.min(this.adaptiveDpr || this.dpr, this.dpr);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.adaptiveDpr);

    if (this.sculpture) {
      this.sculpture.isMobile = this.isMobile;
      this.sculpture.setPixelRatio(this.adaptiveDpr);
    }
  }

  onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;

    // Do not initiate 3D drag on interactive controls or editorial content blocks
    if (e.target && e.target.closest('button, a, input, select, textarea, [role="button"], [role="tab"], .studio-panel, .chapter-rail, .site-header, .text-beside-left, .text-beside-right, .hero-layout, .continuation-layout')) {
      return;
    }

    const now = performance.now();
    this.drag.isDown = true;
    this.drag.hasDragged = false;
    this.drag.startX = e.clientX;
    this.drag.startY = e.clientY;
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    this.drag.lastTime = now;
    this.drag.vx = 0;
    this.drag.vy = 0;
    this.drag.pointerId = e.pointerId;
    this.drag.isTouch = e.pointerType === 'touch';
    this.drag.history = [{ x: e.clientX, y: e.clientY, time: now }];
  }

  onPointerMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (!this.prefersReducedMotion) {
      if (this.sculpture) {
        this.sculpture.setTargetMouse(x, y);
      }
      this.cameraPointerOffset.x = x * 0.28;
      this.cameraPointerOffset.y = y * 0.2;
    }

    if (!this.drag.isDown) return;

    const now = performance.now();
    const dx = e.clientX - this.drag.lastX;
    const dy = e.clientY - this.drag.lastY;
    const totalDx = Math.abs(e.clientX - this.drag.startX);
    const totalDy = Math.abs(e.clientY - this.drag.startY);

    // Record sample into rolling history buffer
    this.drag.history.push({ x: e.clientX, y: e.clientY, time: now });
    while (this.drag.history.length > 8 || (this.drag.history.length > 2 && now - this.drag.history[0].time > 120)) {
      this.drag.history.shift();
    }

    // Touch disambiguation: allow normal vertical scroll if user moves predominantly vertically
    if (this.drag.isTouch && !this.drag.hasDragged) {
      if (totalDy > totalDx * 1.15 && totalDy > 8) {
        this.drag.isDown = false;
        this.drag.history = [];
        return;
      }
    }

    // Engage active drag when moving beyond small deadzone threshold
    if (!this.drag.hasDragged) {
      if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 4) {
        this.drag.hasDragged = true;
        document.body.classList.add('is-dragging');
        if (this.onFirstDrag) {
          this.onFirstDrag();
          this.onFirstDrag = null;
        }
      }
    }

    if (this.drag.hasDragged) {
      if (e.cancelable && this.drag.isTouch) {
        e.preventDefault();
      }

      const dt = Math.max(now - this.drag.lastTime, 8);
      this.drag.vx = (dx / dt) * 16.6;
      this.drag.vy = (dy / dt) * 16.6;

      if (this.sculpture) {
        this.sculpture.applyDrag(dx, dy, this.dragSensitivity);
        if (this.onMotion) {
          this.onMotion(Math.hypot(this.drag.vx, this.drag.vy) * 0.05);
        }
      }
    }

    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    this.drag.lastTime = now;
  }

  onPointerUp(e) {
    if (!this.drag.isDown) return;

    if (this.drag.hasDragged) {
      const now = performance.now();
      const timeSinceLastMove = now - this.drag.lastTime;

      let releaseVx = this.drag.vx;
      let releaseVy = this.drag.vy;

      // If user paused before lifting finger/mouse, damp release velocity
      if (timeSinceLastMove > 80) {
        releaseVx = 0;
        releaseVy = 0;
      } else if (this.drag.history && this.drag.history.length >= 2) {
        // Compute multi-sample smoothed velocity over the trailing 90ms
        const recent = this.drag.history.filter((h) => now - h.time <= 90);
        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dt = Math.max(last.time - first.time, 12);
          releaseVx = ((last.x - first.x) / dt) * 16.6;
          releaseVy = ((last.y - first.y) / dt) * 16.6;
        }
      }

      if (this.sculpture) {
        this.sculpture.releaseDrag(releaseVx, releaseVy, this.dragSensitivity);
      }
      setTimeout(() => {
        this.drag.hasDragged = false;
      }, 80);
    }

    this.drag.isDown = false;
    this.drag.history = [];
    document.body.classList.remove('is-dragging');
  }

  onPointerCancel(e) {
    this.onPointerUp(e);
  }

  onClickCapture(e) {
    if (this.drag.hasDragged) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.lastFpsTime = performance.now();
    this.frameCount = 0;
    this.renderLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  renderLoop() {
    if (!this.isRunning || this.isContextLost) return;

    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    const frameMs = delta * 1000;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // 1. Framerate-independent cinematic camera smoothing
    const camAlpha = Math.min(1.0, 3.8 * delta);
    this._tempTargetPos.set(
      this.cameraTargetPos.x + this.cameraPointerOffset.x,
      this.cameraTargetPos.y + this.cameraPointerOffset.y,
      this.cameraTargetPos.z
    );
    this.cameraCurrentPos.lerp(this._tempTargetPos, camAlpha);
    this.camera.position.copy(this.cameraCurrentPos);

    this.cameraCurrentLook.lerp(this.cameraLookTarget, camAlpha);
    this.camera.lookAt(this.cameraCurrentLook);

    // 2. Framerate-independent sculpture framing offset interpolation
    const framingAlpha = Math.min(1.0, 4.2 * delta);
    this.sculptureCurrentX += (this.sculptureTargetX - this.sculptureCurrentX) * framingAlpha;
    this.sculptureCurrentY += (this.sculptureTargetY - this.sculptureCurrentY) * framingAlpha;
    if (this.sculpture && this.sculpture.group) {
      this.sculpture.group.position.x = this.sculptureCurrentX;
      this.sculpture.group.position.y = this.sculptureCurrentY;
    }

    // 3. Smooth cinematic lighting transitions with dirty checks
    const lightLerp = Math.min(1.0, 4.0 * delta);
    if (this.keyLight) {
      this.keyLight.intensity += (this.lightingTargets.keyIntensity - this.keyLight.intensity) * lightLerp;
    }
    if (this.rimLight) {
      this.rimLight.intensity += (this.lightingTargets.rimIntensity - this.rimLight.intensity) * lightLerp;
      if (!this.rimLight.color.equals(this.lightingTargets.rimColor)) {
        this.rimLight.color.lerp(this.lightingTargets.rimColor, lightLerp);
      }
    }
    if (this.corePointLight) {
      this.corePointLight.intensity += (this.lightingTargets.coreIntensity - this.corePointLight.intensity) * lightLerp;
      if (!this.corePointLight.color.equals(this.lightingTargets.coreColor)) {
        this.corePointLight.color.lerp(this.lightingTargets.coreColor, lightLerp);
      }
    }

    if (this.sculpture) {
      this.sculpture.update(elapsedTime, delta);
      if (this.onMotion && (Math.abs(this.sculpture.userRotation.vx) > 0.0001 || Math.abs(this.sculpture.userRotation.vy) > 0.0001)) {
        this.onMotion(Math.hypot(this.sculpture.userRotation.vx, this.sculpture.userRotation.vy) * 15.0);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.frameTimes.length > 0) {
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p50Idx = Math.floor(sorted.length * 0.5);
        const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
        const p99Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
        this.metrics.p50 = parseFloat(sorted[p50Idx].toFixed(2));
        this.metrics.p95 = parseFloat(sorted[p95Idx].toFixed(2));
        this.metrics.p99 = parseFloat(sorted[p99Idx].toFixed(2));
        this.metrics.avgFps = this.currentFps;
      }

      if (this.renderer && this.renderer.info) {
        this.metrics.drawCalls = this.renderer.info.render.calls;
        this.metrics.triangles = this.renderer.info.render.triangles;
      }

      if (this.onFPSUpdate) {
        this.onFPSUpdate(this.currentFps);
      }

      // Adaptive Rendering Quality: auto-throttle DPR under load to maintain responsive 60fps
      if (this.currentFps < 32) {
        this.lowFpsCount++;
        this.highFpsCount = 0;
        if (this.lowFpsCount >= 2 && this.adaptiveDpr > 1.0) {
          this.adaptiveDpr = 1.0;
          this.renderer.setPixelRatio(this.adaptiveDpr);
          if (this.sculpture) this.sculpture.setPixelRatio(this.adaptiveDpr);
        } else if (this.lowFpsCount >= 4 && this.adaptiveDpr > 0.85) {
          this.adaptiveDpr = 0.85;
          this.renderer.setPixelRatio(this.adaptiveDpr);
          if (this.sculpture) this.sculpture.setPixelRatio(this.adaptiveDpr);
        }
      } else if (this.currentFps >= 56) {
        this.highFpsCount++;
        this.lowFpsCount = 0;
        if (this.highFpsCount >= 6 && this.adaptiveDpr < this.dpr) {
          this.adaptiveDpr = this.dpr;
          this.renderer.setPixelRatio(this.adaptiveDpr);
          if (this.sculpture) this.sculpture.setPixelRatio(this.adaptiveDpr);
        }
      } else {
        this.lowFpsCount = 0;
        this.highFpsCount = 0;
      }
    }
  }

  setLightingState({ keyIntensity = undefined, rimIntensity = undefined, coreIntensity = undefined, rimColor = null, coreColor = null } = {}) {
    if (keyIntensity !== undefined) this.lightingTargets.keyIntensity = keyIntensity;
    if (rimIntensity !== undefined) this.lightingTargets.rimIntensity = rimIntensity;
    if (coreIntensity !== undefined) this.lightingTargets.coreIntensity = coreIntensity;
    if (rimColor !== null) this.lightingTargets.rimColor.set(rimColor);
    if (coreColor !== null) this.lightingTargets.coreColor.set(coreColor);
  }

  setCameraTarget(x, y, z, lookX = 0, lookY = 0, lookZ = 0) {
    if (this.isMobile) {
      this.cameraTargetPos.set(0, y, z + 1.4);
      this.cameraLookTarget.set(0, lookY, lookZ);
    } else if (this.isTablet) {
      this.cameraTargetPos.set(x * 0.45, y, z + 0.8);
      this.cameraLookTarget.set(lookX * 0.45, lookY, lookZ);
    } else {
      this.cameraTargetPos.set(x, y, z);
      this.cameraLookTarget.set(lookX, lookY, lookZ);
    }
  }

  setSculptureFramingOffset(x, y = 0) {
    if (this.isMobile) {
      this.sculptureTargetX = 0;
      this.sculptureTargetY = y * 0.4;
    } else if (this.isTablet) {
      this.sculptureTargetX = x * 0.5;
      this.sculptureTargetY = y * 0.7;
    } else {
      this.sculptureTargetX = x;
      this.sculptureTargetY = y;
    }
  }

  getSculptureRotationAngles() {
    if (!this.sculpture || !this.sculpture.userRotation) {
      this._cachedRotAngles.yaw = 0;
      this._cachedRotAngles.pitch = 0;
      return this._cachedRotAngles;
    }
    const radToDeg = 180 / Math.PI;
    this._cachedRotAngles.yaw = Math.round(this.sculpture.userRotation.yaw * radToDeg);
    this._cachedRotAngles.pitch = Math.round(this.sculpture.userRotation.pitch * radToDeg);
    return this._cachedRotAngles;
  }

  getPerformanceMetrics() {
    return {
      ...this.metrics,
      fps: this.currentFps,
      adaptiveDpr: this.adaptiveDpr,
      dpr: this.dpr
    };
  }

  dispose() {
    this.stop();

    if (this.resizeRaf) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
    window.removeEventListener('click', this.handleClickCapture, { capture: true });
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.removeEventListener && this.handleMotionChange) {
      mediaQuery.removeEventListener('change', this.handleMotionChange);
    }

    if (this.canvas) {
      if (this.handleContextLost) this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      if (this.handleContextRestored) this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    if (this.sculpture) {
      this.sculpture.dispose();
      if (this.scene) this.scene.remove(this.sculpture.group);
      this.sculpture = null;
    }

    [this.ambientLight, this.keyLight, this.rimLight, this.fillLight, this.bounceLight, this.corePointLight].forEach((light) => {
      if (light) {
        if (this.scene) this.scene.remove(light);
        if (light.dispose) light.dispose();
      }
    });

    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = null;
    }

    if (this.scene) {
      this.scene.environment = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (typeof window !== 'undefined' && window.__afterlight_scene === this) {
      delete window.__afterlight_scene;
    }

    this.scene = null;
    this.camera = null;
  }
}

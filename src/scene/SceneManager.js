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
  constructor({ canvas, onFPSUpdate = null, onWebGLError = null, onFirstDrag = null } = {}) {
    this.canvas = canvas;
    this.onFPSUpdate = onFPSUpdate;
    this.onWebGLError = onWebGLError;
    this.onFirstDrag = onFirstDrag;

    this.isRunning = false;
    this.animationFrameId = null;
    this.clock = new THREE.Clock();

    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60;

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

    // Camera target vectors
    this.cameraCurrentPos = new THREE.Vector3(0, 0, 7.8);
    this.cameraTargetPos = new THREE.Vector3(0, 0, 7.8);
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
    this.sculptureTargetX = 0;
    this.sculptureCurrentX = 0;
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

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const initialZ = this.isMobile ? 9.2 : 7.8;
    this.cameraTargetPos.set(0, 0, initialZ);
    this.cameraLookTarget.set(0, 0, 0);
    this.cameraCurrentPos.copy(this.cameraTargetPos);
    this.cameraCurrentLook.copy(this.cameraLookTarget);
    this.camera.position.copy(this.cameraCurrentPos);

    this.sculptureTargetX = this.isMobile ? 0 : 1.25;
    this.sculptureCurrentX = this.sculptureTargetX;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    if (!this.renderer || !this.camera) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.isMobile = width < 768;
    this.dragSensitivity = (Math.PI / Math.min(width || 1440, 1600)) * 1.5;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.dpr);

    if (this.sculpture) {
      this.sculpture.setPixelRatio(this.dpr);
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
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

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

    // 3. Smooth cinematic lighting transitions
    const lightLerp = Math.min(1.0, 4.0 * delta);
    if (this.keyLight) {
      this.keyLight.intensity += (this.lightingTargets.keyIntensity - this.keyLight.intensity) * lightLerp;
    }
    if (this.rimLight) {
      this.rimLight.intensity += (this.lightingTargets.rimIntensity - this.rimLight.intensity) * lightLerp;
      this.rimLight.color.lerp(this.lightingTargets.rimColor, lightLerp);
    }
    if (this.corePointLight) {
      this.corePointLight.intensity += (this.lightingTargets.coreIntensity - this.corePointLight.intensity) * lightLerp;
      this.corePointLight.color.lerp(this.lightingTargets.coreColor, lightLerp);
    }

    if (this.sculpture) {
      this.sculpture.update(elapsedTime, delta);
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
      if (this.onFPSUpdate) {
        this.onFPSUpdate(this.currentFps);
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
    } else {
      this.cameraTargetPos.set(x, y, z);
      this.cameraLookTarget.set(lookX, lookY, lookZ);
    }
  }

  setSculptureFramingOffset(x, y = 0) {
    if (this.isMobile) {
      this.sculptureTargetX = 0;
      this.sculptureTargetY = y * 0.4;
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

  dispose() {
    this.stop();

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
    window.removeEventListener('click', this.handleClickCapture, { capture: true });
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.sculpture) {
      this.sculpture.dispose();
      this.scene.remove(this.sculpture.group);
      this.sculpture = null;
    }

    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
  }
}

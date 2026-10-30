import * as THREE from 'three';
import {
  filamentVertexShader,
  filamentFragmentShader,
  stardustVertexShader,
  stardustFragmentShader
} from './shaders.js';

/**
 * Procedural Multi-Layered Sculpture for AFTERLIGHT
 * 1. Reflective Liquid-Metal Core (Parametric Manifold)
 * 2. Translucent Obsidian Glass-like Interwoven Ribbons
 * 3. Fine Luminous Filaments (Silky Orbital Geodesics)
 * 4. Quantum Stardust Particulate Field
 */
export class Sculpture {
  constructor({ pixelRatio = 1.0, isMobile = false } = {}) {
    this.pixelRatio = pixelRatio;
    this.isMobile = isMobile;

    this.group = new THREE.Group();
    this.interactionGroup = new THREE.Group();
    this.contentGroup = new THREE.Group();

    this.group.add(this.interactionGroup);
    this.interactionGroup.add(this.contentGroup);

    // User direct manipulation & inertia state
    this.userRotation = {
      pitch: 0.0,
      yaw: 0.0,
      roll: 0.0,
      targetPitch: 0.0,
      targetYaw: 0.0,
      targetRoll: 0.0,
      vx: 0.0,
      vy: 0.0,
      isDragging: false
    };

    // Artistic state variables (0.0 to 1.0)
    this.state = {
      tension: 0.0,
      dissolution: 0.0,
      reformation: 0.0,
      rotationSpeedFactor: 1.0,
      deformationFactor: 1.0,
      filamentIntensity: 1.0,
      activePalette: 'lapis'
    };

    // Smooth transition weights for cinematic morphing
    this.targetWeights = {
      tension: 0.0,
      dissolution: 0.0,
      reformation: 0.0
    };

    // Smooth material palette color targets
    this.paletteColors = {
      core: new THREE.Color(0xf0f3f6),
      ribbon: new THREE.Color(0x0e121e),
      specular: new THREE.Color(0x8faaff),
      filamentBase: new THREE.Color(0x3d68ff),
      filamentAccent: new THREE.Color(0xf6f5f3)
    };

    this.mouseCurrent = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);

    this.baseRotationSpeed = 0.07;
    this.pulseEnergy = 0.0;

    this.init();
  }

  init() {
    this.initCoreManifold();
    this.initGlassRibbons();
    this.initFilaments();
    this.initStardustField();
  }

  // =========================================================================
  // 1. LIQUID-METAL CORE MANIFOLD
  // =========================================================================
  initCoreManifold() {
    const uSegments = this.isMobile ? 120 : 180;
    const vSegments = this.isMobile ? 36 : 48;
    const vertexCount = (uSegments + 1) * (vSegments + 1);

    const positionsBase = new Float32Array(vertexCount * 3);
    const positionsTension = new Float32Array(vertexCount * 3);
    const positionsReformed = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = [];

    let ptr = 0;
    let uvPtr = 0;

    for (let i = 0; i <= uSegments; i++) {
      const u = (i / uSegments) * Math.PI * 2;

      // Base Trefoil knot central spine
      const rBase = 1.35 + 0.48 * Math.cos(3 * u);
      const cx = rBase * Math.cos(2 * u);
      const cy = rBase * Math.sin(2 * u);
      const cz = -0.65 * Math.sin(3 * u);

      // Spine tangent and frame
      const du = 0.001;
      const uNext = u + du;
      const rNext = 1.35 + 0.48 * Math.cos(3 * uNext);
      const tx = (rNext * Math.cos(2 * uNext) - cx) / du;
      const ty = (rNext * Math.sin(2 * uNext) - cy) / du;
      const tz = (-0.65 * Math.sin(3 * uNext) - cz) / du;

      const tangent = new THREE.Vector3(tx, ty, tz).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      for (let j = 0; j <= vSegments; j++) {
        const v = (j / vSegments) * Math.PI * 2;

        const tubeRadius = 0.32 + 0.1 * Math.cos(3 * u + v) + 0.04 * Math.sin(5 * u);
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);

        const offsetX = (normal.x * cosV + binormal.x * sinV) * tubeRadius;
        const offsetY = (normal.y * cosV + binormal.y * sinV) * tubeRadius;
        const offsetZ = (normal.z * cosV + binormal.z * sinV) * tubeRadius;

        // Base
        positionsBase[ptr] = cx + offsetX;
        positionsBase[ptr + 1] = cy + offsetY;
        positionsBase[ptr + 2] = cz + offsetZ;

        // Tension (Stretched, helically unwound knot)
        const stretchX = (cx + offsetX) * 1.5;
        const twistAngle = 0.5 * u;
        const rotY = (cy + offsetY) * Math.cos(twistAngle) - (cz + offsetZ) * Math.sin(twistAngle);
        const rotZ = (cy + offsetY) * Math.sin(twistAngle) + (cz + offsetZ) * Math.cos(twistAngle);
        positionsTension[ptr] = stretchX;
        positionsTension[ptr + 1] = rotY * 0.72;
        positionsTension[ptr + 2] = rotZ * 1.2;

        // Reformed Bloom (5-lobed symmetrical crystalline ring)
        const rBloom = 1.95 + 0.4 * Math.cos(5 * u);
        const bx = rBloom * Math.cos(u) + offsetX * 0.65;
        const by = rBloom * Math.sin(u) + offsetY * 0.65;
        const bz = Math.sin(5 * u) * 0.35 + offsetZ * 0.65;
        positionsReformed[ptr] = bx;
        positionsReformed[ptr + 1] = by;
        positionsReformed[ptr + 2] = bz;

        uvs[uvPtr] = i / uSegments;
        uvs[uvPtr + 1] = j / vSegments;

        ptr += 3;
        uvPtr += 2;
      }
    }

    for (let i = 0; i < uSegments; i++) {
      for (let j = 0; j < vSegments; j++) {
        const a = i * (vSegments + 1) + j;
        const b = (i + 1) * (vSegments + 1) + j;
        const c = (i + 1) * (vSegments + 1) + (j + 1);
        const d = i * (vSegments + 1) + (j + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positionsBase, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    geometry.morphAttributes.position = [
      new THREE.BufferAttribute(positionsTension, 3),
      new THREE.BufferAttribute(positionsReformed, 3)
    ];

    this.coreMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf0f3f6),
      metalness: 0.94,
      roughness: 0.11,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.96,
      iridescence: 0.28,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 380],
      envMapIntensity: 2.2
    });

    this.coreMesh = new THREE.Mesh(geometry, this.coreMaterial);
    this.coreMesh.morphTargetInfluences = [0, 0];
    this.contentGroup.add(this.coreMesh);
  }

  // =========================================================================
  // 2. TRANSLUCENT GLASS-LIKE INTERWOVEN RIBBONS
  // =========================================================================
  initGlassRibbons() {
    const steps = this.isMobile ? 140 : 220;
    const width = 0.38;

    const positionsBase = [];
    const positionsTension = [];
    const positionsReformed = [];
    const indices = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;

      const r = 1.95 + 0.3 * Math.sin(4 * t);
      const cx = r * Math.cos(2 * t);
      const cy = r * Math.sin(2 * t);
      const cz = 0.75 * Math.cos(3 * t);

      const twist = 3.0 * t;
      const nx = Math.cos(twist) * width;
      const ny = Math.sin(twist) * width;
      const nz = Math.sin(twist * 2.0) * (width * 0.4);

      const idx = (i * 2);

      positionsBase.push(cx - nx, cy - ny, cz - nz);
      positionsBase.push(cx + nx, cy + ny, cz + nz);

      positionsTension.push(
        (cx - nx) * 1.5,
        (cy - ny) * 0.7,
        (cz - nz) * 1.3
      );
      positionsTension.push(
        (cx + nx) * 1.5,
        (cy + ny) * 0.7,
        (cz + nz) * 1.3
      );

      const rBloom = 2.4;
      positionsReformed.push(
        rBloom * Math.cos(t) - nx * 0.45,
        rBloom * Math.sin(t) - ny * 0.45,
        Math.cos(2 * t) * 0.28 - nz * 0.45
      );
      positionsReformed.push(
        rBloom * Math.cos(t) + nx * 0.45,
        rBloom * Math.sin(t) + ny * 0.45,
        Math.cos(2 * t) * 0.28 + nz * 0.45
      );

      if (i < steps) {
        indices.push(idx, idx + 1, idx + 2);
        indices.push(idx + 1, idx + 3, idx + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsBase, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    geometry.morphAttributes.position = [
      new THREE.Float32BufferAttribute(positionsTension, 3),
      new THREE.Float32BufferAttribute(positionsReformed, 3)
    ];

    this.ribbonMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0e121e),
      roughness: 0.05,
      metalness: 0.12,
      transmission: 0.76,
      thickness: 1.4,
      ior: 1.54,
      attenuationColor: new THREE.Color(0x182448),
      attenuationDistance: 1.5,
      specularColor: new THREE.Color(0x8faaff),
      specularIntensity: 1.4,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      envMapIntensity: 2.4
    });

    this.ribbonMesh = new THREE.Mesh(geometry, this.ribbonMaterial);
    this.ribbonMesh.morphTargetInfluences = [0, 0];
    this.contentGroup.add(this.ribbonMesh);
  }

  // =========================================================================
  // 3. FINE LUMINOUS FILAMENTS (SILKY GEODESICS)
  // =========================================================================
  initFilaments() {
    const numCurves = this.isMobile ? 14 : 24;
    const pointsPerCurve = 110; // High resolution for silky smooth curves
    const totalPoints = numCurves * pointsPerCurve;

    const positions = new Float32Array(totalPoints * 3);
    const progressAttr = new Float32Array(totalPoints);
    const lineIdAttr = new Float32Array(totalPoints);
    const indices = [];

    let ptr = 0;
    for (let c = 0; c < numCurves; c++) {
      const phase = (c / numCurves) * Math.PI * 2;
      const radiusBase = 1.6 + 0.45 * Math.sin(phase * 2);
      const zScale = 0.8 + 0.25 * Math.cos(phase);

      const startIndex = c * pointsPerCurve;

      for (let p = 0; p < pointsPerCurve; p++) {
        const t = (p / (pointsPerCurve - 1)) * Math.PI * 2;

        // Smooth sinusoidal orbital geodesics
        const x = radiusBase * Math.cos(t + phase) * (1.0 + 0.18 * Math.cos(3 * t));
        const y = radiusBase * Math.sin(t + phase) * (1.0 + 0.18 * Math.sin(2 * t));
        const z = zScale * Math.sin(2 * t + phase * 2);

        positions[ptr] = x;
        positions[ptr + 1] = y;
        positions[ptr + 2] = z;

        const idx = c * pointsPerCurve + p;
        progressAttr[idx] = p / (pointsPerCurve - 1);
        lineIdAttr[idx] = c;

        if (p < pointsPerCurve - 1) {
          indices.push(startIndex + p, startIndex + p + 1);
        }

        ptr += 3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(progressAttr, 1));
    geometry.setAttribute('aLineId', new THREE.BufferAttribute(lineIdAttr, 1));
    geometry.setIndex(indices);

    this.filamentUniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uDissolution: { value: 0 },
      uIntensity: { value: 1.0 },
      uBaseColor: { value: new THREE.Color(0x3d68ff) },
      uAccentColor: { value: new THREE.Color(0xf6f5f3) }
    };

    this.filamentMaterial = new THREE.ShaderMaterial({
      vertexShader: filamentVertexShader,
      fragmentShader: filamentFragmentShader,
      uniforms: this.filamentUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.filaments = new THREE.LineSegments(geometry, this.filamentMaterial);
    this.contentGroup.add(this.filaments);
  }

  // =========================================================================
  // 4. QUANTUM STARDUST PARTICULATE FIELD
  // =========================================================================
  initStardustField() {
    const particleCount = this.isMobile ? 8000 : 16000;

    const posBase = new Float32Array(particleCount * 3);
    const posTension = new Float32Array(particleCount * 3);
    const posDissolution = new Float32Array(particleCount * 3);
    const posReformation = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const u = (i / particleCount) * Math.PI * 2 * 3;
      const r = 1.45 + 0.45 * Math.cos(3 * u);
      const cx = r * Math.cos(2 * u);
      const cy = r * Math.sin(2 * u);
      const cz = -0.6 * Math.sin(3 * u);

      const spread = 0.2 * Math.pow(Math.random(), 1.5);
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * spread;
      const dy = Math.sin(angle) * spread;
      const dz = (Math.random() - 0.5) * spread;

      const idx = i * 3;

      posBase[idx] = cx + dx;
      posBase[idx + 1] = cy + dy;
      posBase[idx + 2] = cz + dz;

      posTension[idx] = (cx + dx) * 1.5;
      posTension[idx + 1] = (cy + dy) * 0.7;
      posTension[idx + 2] = (cz + dz) * 1.25;

      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      const radDiss = 2.0 + Math.random() * 2.5;
      posDissolution[idx] = radDiss * Math.sin(phi) * Math.cos(theta);
      posDissolution[idx + 1] = radDiss * Math.sin(phi) * Math.sin(theta);
      posDissolution[idx + 2] = radDiss * Math.cos(phi);

      const shellR = 1.4 + (i % 3) * 0.65;
      const pPhi = Math.acos(1.0 - (2.0 * (i + 0.5)) / particleCount);
      const pTheta = Math.PI * (3.0 - Math.sqrt(5.0)) * i;
      posReformation[idx] = shellR * Math.sin(pPhi) * Math.cos(pTheta);
      posReformation[idx + 1] = shellR * Math.sin(pPhi) * Math.sin(pTheta);
      posReformation[idx + 2] = shellR * Math.cos(pPhi);

      randoms[i] = Math.random();
      sizes[i] = Math.random() > 0.95 ? 0.04 : 0.018;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posBase, 3));
    geometry.setAttribute('aPosTension', new THREE.BufferAttribute(posTension, 3));
    geometry.setAttribute('aPosDissolution', new THREE.BufferAttribute(posDissolution, 3));
    geometry.setAttribute('aPosReformation', new THREE.BufferAttribute(posReformation, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.stardustUniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uDissolution: { value: 0 },
      uReformation: { value: 0 },
      uPixelRatio: { value: this.pixelRatio },
      uMouse: { value: new THREE.Vector2(0, 0) }
    };

    this.stardustMaterial = new THREE.ShaderMaterial({
      vertexShader: stardustVertexShader,
      fragmentShader: stardustFragmentShader,
      uniforms: this.stardustUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.stardust = new THREE.Points(geometry, this.stardustMaterial);
    this.contentGroup.add(this.stardust);
  }

  setChapterWeights({ tension = 0, dissolution = 0, reformation = 0, immediate = false } = {}) {
    const clampedT = THREE.MathUtils.clamp(tension, 0, 1);
    const clampedD = THREE.MathUtils.clamp(dissolution, 0, 1);
    const clampedR = THREE.MathUtils.clamp(reformation, 0, 1);

    this.targetWeights.tension = clampedT;
    this.targetWeights.dissolution = clampedD;
    this.targetWeights.reformation = clampedR;

    if (immediate) {
      this.state.tension = clampedT;
      this.state.dissolution = clampedD;
      this.state.reformation = clampedR;
      this.applyMorphInfluences();
    }
  }

  applyMorphInfluences() {
    const t = this.state.tension;
    const d = this.state.dissolution;
    const r = this.state.reformation;

    if (this.coreMesh && this.coreMesh.morphTargetInfluences) {
      this.coreMesh.morphTargetInfluences[0] = t * (1.0 - r);
      this.coreMesh.morphTargetInfluences[1] = r;
    }

    if (this.ribbonMesh && this.ribbonMesh.morphTargetInfluences) {
      this.ribbonMesh.morphTargetInfluences[0] = t * (1.0 - r);
      this.ribbonMesh.morphTargetInfluences[1] = r;
    }

    if (this.filamentUniforms) {
      this.filamentUniforms.uTension.value = t;
      this.filamentUniforms.uDissolution.value = d;
    }

    if (this.stardustUniforms) {
      this.stardustUniforms.uTension.value = t;
      this.stardustUniforms.uDissolution.value = d;
      this.stardustUniforms.uReformation.value = r;
    }
  }

  setPreset(preset) {
    switch (preset) {
      case 'origin':
        this.setChapterWeights({ tension: 0, dissolution: 0, reformation: 0, immediate: false });
        break;
      case 'tension':
        this.setChapterWeights({ tension: 1, dissolution: 0, reformation: 0, immediate: false });
        break;
      case 'dissolution':
        this.setChapterWeights({ tension: 0.5, dissolution: 1, reformation: 0, immediate: false });
        break;
      case 'reformation':
        this.setChapterWeights({ tension: 0, dissolution: 0, reformation: 1, immediate: false });
        break;
    }
  }

  setRotationSpeed(factor) {
    this.state.rotationSpeedFactor = factor;
  }

  setDeformation(factor) {
    this.state.deformationFactor = factor;
  }

  setFilamentIntensity(intensity) {
    this.state.filamentIntensity = intensity;
    if (this.filamentUniforms) {
      this.filamentUniforms.uIntensity.value = intensity;
    }
  }

  setPalette(paletteKey) {
    this.state.activePalette = paletteKey;
    switch (paletteKey) {
      case 'lapis':
        this.paletteColors.core.set(0xf0f3f6);
        this.paletteColors.ribbon.set(0x0e121e);
        this.paletteColors.specular.set(0x8faaff);
        this.paletteColors.filamentBase.set(0x3d68ff);
        this.paletteColors.filamentAccent.set(0xf6f5f3);
        break;
      case 'platinum':
        this.paletteColors.core.set(0xffffff);
        this.paletteColors.ribbon.set(0x18181c);
        this.paletteColors.specular.set(0xffffff);
        this.paletteColors.filamentBase.set(0xa0a0a8);
        this.paletteColors.filamentAccent.set(0xffffff);
        break;
      case 'aurelia':
        this.paletteColors.core.set(0xfdf7eb);
        this.paletteColors.ribbon.set(0x1c1712);
        this.paletteColors.specular.set(0xf5cf78);
        this.paletteColors.filamentBase.set(0xe8ad38);
        this.paletteColors.filamentAccent.set(0xfff5dd);
        break;
      case 'spectral':
        this.paletteColors.core.set(0xf4f1fa);
        this.paletteColors.ribbon.set(0x181224);
        this.paletteColors.specular.set(0xbf96ff);
        this.paletteColors.filamentBase.set(0x9d54ff);
        this.paletteColors.filamentAccent.set(0xf8f2ff);
        break;
    }
  }

  setTargetMouse(x, y) {
    this.mouseTarget.set(x, y);
  }

  triggerPulse(intensity = 1.0) {
    this.pulseEnergy = intensity;
  }

  applyDrag(deltaX, deltaY, sensitivity) {
    this.userRotation.isDragging = true;
    this.userRotation.targetYaw += deltaX * sensitivity;

    // Pitch soft boundary with elastic resistance
    const maxPitch = 0.78;
    const currentPitch = this.userRotation.targetPitch;
    let effectiveDy = deltaY * sensitivity;

    if (currentPitch > maxPitch && deltaY > 0) {
      const resistance = 1.0 + (currentPitch - maxPitch) * 8.0;
      effectiveDy /= resistance;
    } else if (currentPitch < -maxPitch && deltaY < 0) {
      const resistance = 1.0 + (-maxPitch - currentPitch) * 8.0;
      effectiveDy /= resistance;
    }

    this.userRotation.targetPitch = THREE.MathUtils.clamp(
      this.userRotation.targetPitch + effectiveDy,
      -1.0,
      1.0
    );
  }

  releaseDrag(vx, vy, sensitivity) {
    this.userRotation.isDragging = false;
    const maxV = 0.045;
    this.userRotation.vx = THREE.MathUtils.clamp(vx * sensitivity * 1.15, -maxV, maxV);
    this.userRotation.vy = THREE.MathUtils.clamp(vy * sensitivity * 1.15, -maxV, maxV);
  }

  resetUserRotation(immediate = false) {
    this.userRotation.vx = 0.0;
    this.userRotation.vy = 0.0;
    this.userRotation.targetYaw = 0.0;
    this.userRotation.targetPitch = 0.0;
    this.userRotation.targetRoll = 0.0;

    if (immediate) {
      this.userRotation.yaw = 0.0;
      this.userRotation.pitch = 0.0;
      this.userRotation.roll = 0.0;
      this.interactionGroup.rotation.y = 0.0;
      this.interactionGroup.rotation.x = 0.0;
      this.interactionGroup.rotation.z = 0.0;
    }
  }

  reset(immediate = true) {
    this.setChapterWeights({ tension: 0, dissolution: 0, reformation: 0, immediate: false });
    this.state.rotationSpeedFactor = 1.0;
    this.state.deformationFactor = 1.0;
    this.state.filamentIntensity = 1.0;
    this.setPalette('lapis');
    this.mouseTarget.set(0, 0);
    this.resetUserRotation(immediate);
  }

  update(time, delta) {
    this.mouseCurrent.lerp(this.mouseTarget, 0.05);

    if (this.pulseEnergy > 0.001) {
      this.pulseEnergy *= 0.93;
    } else {
      this.pulseEnergy = 0.0;
    }

    // 1. Direct manipulation with smooth deceleration and physical damping
    if (!this.userRotation.isDragging) {
      // Framerate-independent exponential damping (friction factor = 2.6)
      const damp = Math.exp(-2.6 * Math.min(delta, 0.1));
      this.userRotation.vx *= damp;
      this.userRotation.vy *= damp;

      if (Math.abs(this.userRotation.vx) > 0.00002) {
        this.userRotation.targetYaw += this.userRotation.vx;
      } else {
        this.userRotation.vx = 0.0;
      }

      if (Math.abs(this.userRotation.vy) > 0.00002) {
        this.userRotation.targetPitch += this.userRotation.vy;
      } else {
        this.userRotation.vy = 0.0;
      }

      // Gentle spring return if pitch drifted into overscroll zone
      const maxPitch = 0.78;
      if (this.userRotation.targetPitch > maxPitch) {
        this.userRotation.targetPitch += (maxPitch - this.userRotation.targetPitch) * Math.min(1.0, 10.0 * delta);
        this.userRotation.vy *= 0.7;
      } else if (this.userRotation.targetPitch < -maxPitch) {
        this.userRotation.targetPitch += (-maxPitch - this.userRotation.targetPitch) * Math.min(1.0, 10.0 * delta);
        this.userRotation.vy *= 0.7;
      }
    }

    // High-responsiveness rotational interpolation
    const followSpeed = this.userRotation.isDragging ? 0.38 : 0.14;
    this.userRotation.yaw += (this.userRotation.targetYaw - this.userRotation.yaw) * followSpeed;
    this.userRotation.pitch += (this.userRotation.targetPitch - this.userRotation.pitch) * followSpeed;

    // Subtle gyroscopic bank/roll tilt based on rotational momentum
    const targetRoll = THREE.MathUtils.clamp(-this.userRotation.vx * 1.6, -0.12, 0.12);
    this.userRotation.roll += (targetRoll - this.userRotation.roll) * 0.1;

    // Apply user rotation to interactionGroup (completely separate from autonomous rotation)
    this.interactionGroup.rotation.y = this.userRotation.yaw;
    this.interactionGroup.rotation.x = this.userRotation.pitch;
    this.interactionGroup.rotation.z = this.userRotation.roll;

    // 2. Autonomous idle rotation applied to contentGroup
    const speed = this.baseRotationSpeed * this.state.rotationSpeedFactor;
    this.contentGroup.rotation.y = time * speed;
    this.contentGroup.rotation.x = 0.22 + Math.sin(time * 0.06) * 0.04 * this.state.deformationFactor;
    this.contentGroup.rotation.z = Math.cos(time * 0.05) * 0.03 * this.state.deformationFactor;

    // 3. Smooth morph target weights interpolation
    const morphLerp = Math.min(1.0, 8.0 * delta);
    this.state.tension += (this.targetWeights.tension - this.state.tension) * morphLerp;
    this.state.dissolution += (this.targetWeights.dissolution - this.state.dissolution) * morphLerp;
    this.state.reformation += (this.targetWeights.reformation - this.state.reformation) * morphLerp;
    this.applyMorphInfluences();

    // 4. Smooth material palette color transitions
    const colorLerp = Math.min(1.0, 6.0 * delta);
    if (this.coreMaterial) {
      this.coreMaterial.color.lerp(this.paletteColors.core, colorLerp);
    }
    if (this.ribbonMaterial) {
      this.ribbonMaterial.color.lerp(this.paletteColors.ribbon, colorLerp);
      this.ribbonMaterial.specularColor.lerp(this.paletteColors.specular, colorLerp);
    }
    if (this.filamentUniforms) {
      this.filamentUniforms.uBaseColor.value.lerp(this.paletteColors.filamentBase, colorLerp);
      this.filamentUniforms.uAccentColor.value.lerp(this.paletteColors.filamentAccent, colorLerp);
    }

    const baseScale = 1.0 + this.pulseEnergy * 0.08;
    this.group.scale.set(baseScale, baseScale, baseScale);

    if (this.filamentUniforms) {
      this.filamentUniforms.uTime.value = time;
    }

    if (this.stardustUniforms) {
      this.stardustUniforms.uTime.value = time;
      this.stardustUniforms.uMouse.value.copy(this.mouseCurrent);
    }
  }

  setPixelRatio(dpr) {
    this.pixelRatio = dpr;
    if (this.stardustUniforms) {
      this.stardustUniforms.uPixelRatio.value = dpr;
    }
  }

  dispose() {
    [this.coreMesh, this.ribbonMesh, this.filaments, this.stardust].forEach((obj) => {
      if (obj) {
        if (this.contentGroup) this.contentGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      }
    });
    if (this.interactionGroup && this.contentGroup) {
      this.interactionGroup.remove(this.contentGroup);
    }
    if (this.group && this.interactionGroup) {
      this.group.remove(this.interactionGroup);
    }
    this.coreMesh = null;
    this.ribbonMesh = null;
    this.filaments = null;
    this.stardust = null;
    this.contentGroup = null;
    this.interactionGroup = null;
  }
}

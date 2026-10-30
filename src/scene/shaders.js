// GLSL Shaders for AFTERLIGHT procedural sculpture layers

/**
 * Filament Shader: Delivers travelling luminous light pulses along orbital splines
 */
export const filamentVertexShader = /* glsl */ `
  attribute float aProgress;
  attribute float aLineId;

  uniform float uTime;
  uniform float uTension;
  uniform float uDissolution;

  varying float vProgress;
  varying float vLineId;

  void main() {
    vProgress = aProgress;
    vLineId = aLineId;

    vec3 pos = position;

    // Organic harmonic breathing
    float wave = sin(uTime * 1.2 + aProgress * 6.28 + aLineId * 1.5) * 0.04;
    pos += normal * wave;

    // Tension stretching
    pos.x *= (1.0 + uTension * 0.35);

    // Dissolution jitter
    if (uDissolution > 0.01) {
      float jitter = sin(aProgress * 40.0 + uTime * 4.0) * uDissolution * 0.15;
      pos += vec3(jitter, sin(pos.x * 5.0) * jitter, cos(pos.y * 5.0) * jitter);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const filamentFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uBaseColor;
  uniform vec3 uAccentColor;

  varying float vProgress;
  varying float vLineId;

  void main() {
    // Travelling energy pulse along the spline
    float pulseSpeed = 2.4;
    float pulse = sin(vProgress * 18.0 - uTime * pulseSpeed + vLineId * 2.1) * 0.5 + 0.5;
    pulse = pow(pulse, 3.8); // High-energy luminous peak

    // Secondary micro-shimmer
    float shimmer = sin(vProgress * 60.0 + uTime * 6.0) * 0.12;

    // Blend base electric color with radiant luminous white peak
    vec3 col = mix(uBaseColor, uAccentColor, pulse + shimmer);

    // Dynamic intensity falloff
    float alpha = clamp(0.38 + pulse * 0.62, 0.0, 1.0) * uIntensity;

    gl_FragColor = vec4(col * (0.85 + pulse * 1.5), alpha);
  }
`;

/**
 * Dissolution & Reformation Stardust Particles Shader
 */
export const stardustVertexShader = /* glsl */ `
  attribute vec3 aPosTension;
  attribute vec3 aPosDissolution;
  attribute vec3 aPosReformation;
  attribute float aRandom;
  attribute float aSize;

  uniform float uTime;
  uniform float uTension;
  uniform float uDissolution;
  uniform float uReformation;
  uniform float uPixelRatio;
  uniform vec2 uMouse;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Multi-phase morphological blending
    vec3 pos = position;

    // Blend towards Tension state
    if (uTension > 0.0) {
      pos = mix(pos, aPosTension, uTension);
    }

    // Blend towards Dissolution particle cloud with orbital swirl
    if (uDissolution > 0.0) {
      vec3 dissPos = aPosDissolution;
      float angle = uDissolution * 0.75 + aRandom * 3.14159;
      float sa = sin(angle);
      float ca = cos(angle);
      dissPos.xz = mat2(ca, -sa, sa, ca) * dissPos.xz;
      pos = mix(pos, dissPos, uDissolution);
    }

    // Blend towards Crystalline Reformation bloom
    if (uReformation > 0.0) {
      pos = mix(pos, aPosReformation, uReformation);
    }

    // Organic micro-drift
    vec3 drift = vec3(
      sin(uTime * 0.4 + aRandom * 6.28) * 0.06,
      cos(uTime * 0.35 + aRandom * 6.28) * 0.06,
      sin(uTime * 0.45 + pos.x) * 0.06
    );

    // Mouse magnetic influence
    float mouseDist = length(pos.xy - uMouse * 2.5);
    float mouseWarp = smoothstep(2.0, 0.0, mouseDist) * 0.2;
    vec3 mouseOffset = vec3(uMouse.x, uMouse.y, 0.0) * mouseWarp;

    vec3 finalPos = pos + drift + mouseOffset;

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective point size
    float dist = -mvPosition.z;
    float pointScale = (270.0 / max(dist, 0.1)) * uPixelRatio;
    gl_PointSize = clamp(aSize * pointScale * (0.8 + 0.35 * sin(uTime * 2.2 + aRandom * 6.28)), 1.5, 26.0);

    // Color: Luminous pearlescent white, electric indigo, radiant cyan
    vec3 colWhite = vec3(0.97, 0.97, 0.96);
    vec3 colBlue = vec3(0.31, 0.46, 1.0);
    vec3 colCyan = vec3(0.55, 0.84, 0.98);

    vec3 baseCol = mix(colBlue, colWhite, aRandom * 0.72);
    if (uReformation > 0.25) {
      baseCol = mix(baseCol, colCyan, uReformation * 0.65);
    }

    vColor = baseCol;
    vAlpha = smoothstep(12.5, 2.0, dist) * (0.5 + 0.5 * aRandom);
  }
`;

export const stardustFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float soft = smoothstep(0.5, 0.04, dist);
    float core = smoothstep(0.18, 0.0, dist) * 0.8;

    gl_FragColor = vec4(vColor + vec3(core * 0.35), (soft + core) * vAlpha);
  }
`;

/**
 * AFTERLIGHT — Generative Procedural Ambient Soundscape
 * Built with native Web Audio API (Zero external assets, zero network latency).
 * Delicate, meditative, museum-quality generative soundscape with interactive resonance.
 */

export class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.droneGain = null;
    this.shimmerGain = null;
    this.filterNode = null;
    this.oscillators = [];
    this.isPlaying = false;
    this.isMuted = true;
    this.baseFrequencies = [55, 110, 164.81, 220, 277.18, 329.63]; // A major 9th harmonic series (A1, A2, E3, A3, C#4, E4)
    this.shimmerOscillators = [];
    this.shimmerFilter = null;
  }

  /**
   * Initialize Web Audio Context on first explicit user gesture
   */
  initAudio() {
    if (this.audioCtx) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[AFTERLIGHT Audio] Web Audio API is not supported in this browser.');
        return;
      }

      this.audioCtx = new AudioContextClass();

      // Master Output & Limiter
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      // Warm Low-Pass Master Filter
      this.masterFilter = this.audioCtx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(340, this.audioCtx.currentTime);
      this.masterFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);

      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      // 1. Organic Deep Warm Drone
      this.setupAmbientDrone();

      // 2. Interactive Kinetic Shimmer (responds to 3D sculpture rotation)
      this.setupKineticShimmer();

      // 3. Gracefully manage tab backgrounding / visibility
      this.handleVisibility = () => {
        if (!this.audioCtx) return;
        if (document.hidden && this.isPlaying && this.audioCtx.state === 'running') {
          this.audioCtx.suspend().catch(() => {});
        } else if (!document.hidden && this.isPlaying && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', this.handleVisibility);
    } catch (err) {
      console.warn('[AFTERLIGHT Audio] Failed to initialize Web Audio engine:', err);
      this.audioCtx = null;
    }
  }

  setupAmbientDrone() {
    const ctx = this.audioCtx;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.24, ctx.currentTime);
    this.droneGain.connect(this.masterFilter);

    // Harmonic chords with subtle phase drift
    const freqs = [55.0, 110.0, 164.81, 220.0, 329.63, 440.0];
    const types = ['sine', 'triangle', 'sine', 'sine', 'sine', 'triangle'];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = types[idx] || 'sine';
      // Subtle micro-detune for organic warmth and zero beating roughness
      const detuneCents = (idx - 2.5) * 4.2;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(detuneCents, ctx.currentTime);

      const amp = idx === 0 ? 0.35 : idx === 1 ? 0.28 : 0.12 / (idx + 1);
      oscGain.gain.setValueAtTime(amp, ctx.currentTime);

      // Low frequency modulation for respiration/breathing feeling
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.08 + idx * 0.02, ctx.currentTime); // 12-second breath cycle
      lfoGain.gain.setValueAtTime(amp * 0.25, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);

      osc.connect(oscGain);
      oscGain.connect(this.droneGain);

      osc.start();
      lfo.start();

      this.oscillators.push(osc, lfo);
    });
  }

  setupKineticShimmer() {
    const ctx = this.audioCtx;
    this.shimmerGain = ctx.createGain();
    this.shimmerGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    this.shimmerFilter = ctx.createBiquadFilter();
    this.shimmerFilter.type = 'bandpass';
    this.shimmerFilter.frequency.setValueAtTime(880, ctx.currentTime);
    this.shimmerFilter.Q.setValueAtTime(4.0, ctx.currentTime);

    this.shimmerGain.connect(this.shimmerFilter);
    this.shimmerFilter.connect(this.masterFilter);

    // High crystalline resonant overtones (E5, A5, C#6)
    const shimmerFreqs = [659.25, 880.0, 1108.73];
    shimmerFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(this.shimmerGain);
      osc.start();
      this.shimmerOscillators.push(osc);
    });
  }

  /**
   * Responds to user rotational velocity
   * @param {number} velocity - Current rotational speed
   */
  onSculptureMotion(velocity) {
    if (!this.isPlaying || this.isMuted || !this.audioCtx) return;

    const ctx = this.audioCtx;
    const normV = Math.min(1.0, Math.abs(velocity) * 25.0);

    if (this.shimmerGain && this.shimmerFilter) {
      const now = ctx.currentTime;
      const targetGain = normV > 0.04 ? normV * 0.18 : 0.0001;
      const targetFreq = 700 + normV * 1200;

      this.shimmerGain.gain.setTargetAtTime(targetGain, now, 0.12);
      this.shimmerFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
    }
  }

  /**
   * Subtly modulate tonal color on chapter changes
   * @param {number} chapterNum
   */
  setChapterTone(chapterNum) {
    if (!this.isPlaying || this.isMuted || !this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Harmonic cutoff filters per chapter
    // Ch 01: Deep primordial (340Hz)
    // Ch 02: Structural clarity (440Hz)
    // Ch 03: High tension (580Hz)
    // Ch 04: Diffuse dissolution (650Hz with wider resonance)
    // Ch 05: Crystalline bloom (720Hz)
    // Ch 06: Laboratory focus (480Hz)
    // Ch 07: Cosmic continuation (380Hz)
    const cutoffs = [340, 440, 580, 650, 720, 480, 380];
    const targetCutoff = cutoffs[chapterNum - 1] || 380;

    if (this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(targetCutoff, now, 1.8);
    }
  }

  /**
   * Trigger soft ceremonial harmonic chime on key events (e.g. loader finish, origin return)
   */
  triggerChime(pitchMultiplier = 1.0) {
    if (!this.isPlaying || this.isMuted || !this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.12, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    const chimeFilter = ctx.createBiquadFilter();
    chimeFilter.type = 'bandpass';
    chimeFilter.frequency.setValueAtTime(880 * pitchMultiplier, now);
    chimeFilter.Q.setValueAtTime(6.0, now);

    chimeGain.connect(chimeFilter);
    chimeFilter.connect(this.masterGain);

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note * pitchMultiplier, now);
      osc.connect(chimeGain);
      osc.start(now);
      osc.stop(now + 3.3);
    });
  }

  /**
   * Toggle audio playback state with gentle fade
   */
  async toggle() {
    try {
      this.initAudio();

      if (!this.audioCtx) return false;

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (this.isMuted) {
        // Unmute & Smooth Fade In (1.6s)
        this.isMuted = false;
        this.isPlaying = true;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value || 0.0001, now);
        this.masterGain.gain.linearRampToValueAtTime(0.28, now + 1.6);
        this.triggerChime(1.0);
        return true;
      } else {
        // Mute & Smooth Fade Out (1.2s)
        this.isMuted = true;
        this.isPlaying = false;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
        return false;
      }
    } catch (err) {
      console.warn('[AFTERLIGHT Audio] Toggle audio failed:', err);
      return false;
    }
  }

  dispose() {
    if (this.handleVisibility) {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
    if (this.audioCtx) {
      try {
        this.oscillators.forEach(osc => osc.stop());
        this.shimmerOscillators.forEach(osc => osc.stop());
        this.audioCtx.close();
      } catch (e) {
        // ignore on unload
      }
      this.audioCtx = null;
    }
  }
}

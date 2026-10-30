export class UIController {
  /**
   * @param {Object} options
   * @param {import('../scene/SceneManager.js').SceneManager} options.sceneManager
   * @param {import('../animation/ScrollController.js').ScrollController} options.scrollController
   */
  constructor({ sceneManager, scrollController }) {
    this.sceneManager = sceneManager;
    this.scrollController = scrollController;

    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindHeroActions();
    this.bindPlaygroundControls();
    this.bindContinuation();
    this.initTelemetry();
  }

  bindNavigation() {
    // Logo returns to origin
    const logo = document.querySelector('.nav-logo');
    if (logo) {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollController.scrollToChapter(1);
      });
    }

    // Top navigation anchor links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        if (targetId) {
          const match = targetId.match(/chapter-0(\d)/);
          if (match) {
            this.scrollController.scrollToChapter(parseInt(match[1], 10));
          }
        }
      });
    });

    // Enter Playground button
    const navPlaygroundBtn = document.querySelector('#btn-nav-playground');
    if (navPlaygroundBtn) {
      navPlaygroundBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollController.scrollToChapter(6);
      });
    }

    // Chapter Navigation Rail items
    const railButtons = document.querySelectorAll('.rail-item');
    railButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chapterNum = parseInt(btn.dataset.chapter || '1', 10);
        this.scrollController.scrollToChapter(chapterNum);
      });
    });

    // Mobile / Tablet Chapter Navigation Pill Arrows
    const mobilePrev = document.querySelector('#mobile-prev-chapter');
    if (mobilePrev) {
      mobilePrev.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollController.prevChapter();
      });
    }

    const mobileNext = document.querySelector('#mobile-next-chapter');
    if (mobileNext) {
      mobileNext.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollController.nextChapter();
      });
    }

    const mobileLabel = document.querySelector('#mobile-chapter-label');
    if (mobileLabel) {
      mobileLabel.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.scrollController.currentChapter < 7) {
          this.scrollController.nextChapter();
        } else {
          this.scrollController.returnToOrigin();
        }
      });
    }
  }

  bindHeroActions() {
    const enterExpBtn = document.querySelector('#btn-enter-experience');
    if (!enterExpBtn) return;

    enterExpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.sceneManager?.sculpture) {
        this.sceneManager.sculpture.triggerPulse(1.4);
      }
      setTimeout(() => {
        this.scrollController.scrollToChapter(2);
      }, 120);
    });
  }

  bindContinuation() {
    const returnOriginBtn = document.querySelector('#btn-return-origin');
    if (returnOriginBtn) {
      returnOriginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollController.returnToOrigin();
      });
    }
  }

  bindPlaygroundControls() {
    const sculpture = this.sceneManager?.sculpture;
    if (!sculpture) return;

    // 1. Preset Form Selection Buttons
    const formButtons = document.querySelectorAll('.form-select-btn');
    formButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset || 'origin';

        formButtons.forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');

        sculpture.setPreset(preset);
        sculpture.triggerPulse(0.8);
      });
    });

    // 2. Rotation Speed Segmented Buttons
    const speedButtons = document.querySelectorAll('[data-speed]');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed || '1.0');
        speedButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        sculpture.setRotationSpeed(speed);
      });
    });

    // 3. Surface Deformation Segmented Buttons
    const deformButtons = document.querySelectorAll('[data-deform]');
    deformButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const deform = parseFloat(btn.dataset.deform || '1.0');
        deformButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        sculpture.setDeformation(deform);
      });
    });

    // 4. Material Palette Buttons
    const paletteButtons = document.querySelectorAll('.palette-btn');
    paletteButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const paletteKey = btn.dataset.palette || 'lapis';
        paletteButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        sculpture.setPalette(paletteKey);
      });
    });

    // 5. Filament Glow Segmented Buttons
    const glowButtons = document.querySelectorAll('[data-glow]');
    glowButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const glow = parseFloat(btn.dataset.glow || '1.0');
        glowButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        sculpture.setFilamentIntensity(glow);
      });
    });

    // 6. Reset Sculpture Button
    const resetBtn = document.querySelector('#btn-reset-sculpture');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        sculpture.reset();

        // Restore discovery cue if dismissed
        const hint = document.querySelector('#drag-discovery-hint');
        if (hint) {
          hint.classList.remove('is-dismissed');
        }

        // Restore Preset 01
        formButtons.forEach((b, idx) => {
          b.classList.toggle('is-active', idx === 0);
          b.setAttribute('aria-pressed', String(idx === 0));
        });

        // Restore Speed to Serene (idx 1)
        speedButtons.forEach((b, idx) => b.classList.toggle('is-active', idx === 1));

        // Restore Deform to Harmonic (idx 1)
        deformButtons.forEach((b, idx) => b.classList.toggle('is-active', idx === 1));

        // Restore Palette to Lapis (idx 0)
        paletteButtons.forEach((b, idx) => b.classList.toggle('is-active', idx === 0));

        // Restore Glow to Balanced (idx 1)
        glowButtons.forEach((b, idx) => b.classList.toggle('is-active', idx === 1));

        // Flash feedback
        const badge = document.querySelector('.reset-status-badge');
        if (badge) {
          badge.textContent = 'SCULPTURE RESTORED';
          badge.classList.add('is-visible');
          setTimeout(() => {
            badge.classList.remove('is-visible');
            badge.textContent = '';
          }, 1800);
        }
      });
    }
  }

  onFirstDrag() {
    const hint = document.querySelector('#drag-discovery-hint');
    if (hint) {
      hint.classList.add('is-dismissed');
    }
  }

  initTelemetry() {
    const particleCountEl = document.querySelector('#telemetry-particles');
    if (particleCountEl && this.sceneManager?.sculpture?.isMobile) {
      particleCountEl.textContent = '10,000 GPU';
    }
  }

  updateFPS(fps) {
    const fpsEl = document.querySelector('#telemetry-fps');
    if (fpsEl) {
      fpsEl.textContent = `${fps} FPS`;
    }

    const rotEl = document.querySelector('#telemetry-rotation');
    if (rotEl && this.sceneManager) {
      const angles = this.sceneManager.getSculptureRotationAngles();
      rotEl.textContent = `YAW: ${angles.yaw}° | PITCH: ${angles.pitch}°`;
    }
  }

  static showWebGLFallback() {
    const fallbackEl = document.querySelector('#webgl-fallback');
    if (fallbackEl) fallbackEl.style.display = 'flex';
    const canvas = document.querySelector('#webgl-canvas');
    if (canvas) canvas.style.display = 'none';
  }
}

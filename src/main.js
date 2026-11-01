import { SceneManager } from './scene/SceneManager.js';
import { ScrollController } from './animation/ScrollController.js';
import { UIController } from './ui/UIController.js';
import { SoundManager } from './audio/SoundManager.js';

/**
 * AFTERLIGHT Application Entry Point
 */
function initApp() {
  const canvas = document.querySelector('#webgl-canvas');
  if (!canvas) {
    console.error('[AFTERLIGHT] Canvas element #webgl-canvas not found.');
    return;
  }

  const loaderEl = document.querySelector('#experience-loader');
  const progressBar = document.querySelector('#loader-progress-bar');
  const statusText = document.querySelector('#loader-status-text');
  const statusPct = document.querySelector('#loader-status-pct');

  const updateProgress = (pct, text) => {
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (statusPct) statusPct.textContent = `${String(Math.round(pct)).padStart(2, '0')}%`;
    if (statusText && text) statusText.textContent = text;
    if (loaderEl) loaderEl.setAttribute('aria-valuenow', String(Math.round(pct)));
  };

  updateProgress(20, 'INITIALIZING GRAPHICS ENGINE');

  // Generative Ambient Soundscape (User opt-in, default OFF)
  const soundManager = new SoundManager();

  let uiController = null;
  let scrollController = null;

  // Initialize Three.js Scene and Real-Time Graphics Engine
  let sceneManager = null;
  try {
    sceneManager = new SceneManager({
      canvas,
      onFPSUpdate: (fps) => {
        if (uiController) {
          uiController.updateFPS(fps);
        }
      },
      onFirstDrag: () => {
        if (uiController) {
          uiController.onFirstDrag();
        }
      },
      onMotion: (velocity) => {
        soundManager.onSculptureMotion(velocity);
      },
      onWebGLError: () => {
        if (loaderEl) loaderEl.style.display = 'none';
        UIController.showWebGLFallback();
      }
    });
  } catch (err) {
    console.error('[AFTERLIGHT] Failed to initialize SceneManager:', err);
    if (loaderEl) loaderEl.style.display = 'none';
    UIController.showWebGLFallback();
    return;
  }

  updateProgress(65, 'SYNTHESIZING PROCEDURAL GEOMETRIES');

  // If WebGL initialized successfully, initialize scroll and UI controllers
  if (sceneManager && sceneManager.sculpture) {
    updateProgress(85, 'PRE-WARMING SHADER PIPELINES');

    try {
      scrollController = new ScrollController({
        sceneManager,
        soundManager
      });

      uiController = new UIController({
        sceneManager,
        scrollController,
        soundManager
      });
    } catch (err) {
      console.error('[AFTERLIGHT] Controller initialization error:', err);
    }

    updateProgress(100, 'EQUILIBRIUM ESTABLISHED');

    // Carefully choreographed opening reveal (First 10 seconds)
    setTimeout(() => {
      if (loaderEl) {
        loaderEl.classList.add('is-loaded');
        setTimeout(() => {
          loaderEl.style.display = 'none';
        }, 900);
      }

      // 1. Sculpture awakens from compact core to full presence
      if (sceneManager && sceneManager.sculpture) {
        sceneManager.sculpture.triggerAwakening();
      }

      // 2. Editorial typography and discovery cue glide into view
      if (scrollController) {
        scrollController.triggerHeroEntrance();
      }
    }, 350);
  } else {
    if (loaderEl) loaderEl.style.display = 'none';
    UIController.showWebGLFallback();
  }

  // Graceful cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (uiController) uiController.dispose();
    soundManager.dispose();
    if (scrollController) scrollController.dispose();
    if (sceneManager) sceneManager.dispose();
  });
}

// Global exception boundary to prevent frozen loader or blank screen
window.addEventListener('error', (event) => {
  console.error('[AFTERLIGHT Global Error]:', event.error || event.message);
  const loaderEl = document.querySelector('#experience-loader');
  if (loaderEl && !loaderEl.classList.contains('is-loaded')) {
    loaderEl.classList.add('is-loaded');
    setTimeout(() => {
      loaderEl.style.display = 'none';
    }, 300);
    UIController.showFatalNotice(event?.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[AFTERLIGHT Unhandled Rejection]:', event.reason);
});

// Bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

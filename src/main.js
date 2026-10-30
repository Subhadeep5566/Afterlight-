import { SceneManager } from './scene/SceneManager.js';
import { ScrollController } from './animation/ScrollController.js';
import { UIController } from './ui/UIController.js';

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

  let uiController = null;
  let scrollController = null;

  // Initialize Three.js Scene and Real-Time Graphics Engine
  const sceneManager = new SceneManager({
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
    onWebGLError: () => {
      if (loaderEl) loaderEl.style.display = 'none';
      UIController.showWebGLFallback();
    }
  });

  updateProgress(65, 'SYNTHESIZING PROCEDURAL GEOMETRIES');

  // If WebGL initialized successfully, initialize scroll and UI controllers
  if (sceneManager.sculpture) {
    updateProgress(85, 'PRE-WARMING SHADER PIPELINES');

    scrollController = new ScrollController({
      sceneManager
    });

    uiController = new UIController({
      sceneManager,
      scrollController
    });

    updateProgress(100, 'EQUILIBRIUM ESTABLISHED');

    // Smooth cinematic curtain reveal
    setTimeout(() => {
      if (loaderEl) {
        loaderEl.classList.add('is-loaded');
        setTimeout(() => {
          loaderEl.style.display = 'none';
        }, 900);
      }
      if (sceneManager.sculpture) {
        sceneManager.sculpture.triggerPulse(1.2);
      }
    }, 350);
  } else {
    if (loaderEl) loaderEl.style.display = 'none';
  }

  // Graceful cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (scrollController) scrollController.dispose();
    if (sceneManager) sceneManager.dispose();
  });
}

// Bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

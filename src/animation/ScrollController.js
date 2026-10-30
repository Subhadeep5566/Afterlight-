import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export class ScrollController {
  /**
   * @param {Object} options
   * @param {import('../scene/SceneManager.js').SceneManager} options.sceneManager
   * @param {Function} [options.onChapterChange]
   */
  constructor({ sceneManager, onChapterChange = null }) {
    this.sceneManager = sceneManager;
    this.onChapterChange = onChapterChange;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.triggers = [];
    this.currentChapter = 1;

    this.init();
  }

  init() {
    if (!this.sceneManager || !this.sceneManager.sculpture) return;

    const sculpture = this.sceneManager.sculpture;

    const sections = [
      document.querySelector('#chapter-01'),
      document.querySelector('#chapter-02'),
      document.querySelector('#chapter-03'),
      document.querySelector('#chapter-04'),
      document.querySelector('#chapter-05'),
      document.querySelector('#chapter-06'),
      document.querySelector('#chapter-07')
    ];

    // Chapter Active Detection & Rail Update
    sections.forEach((section, index) => {
      if (!section) return;
      const chapterNum = index + 1;

      const railTrigger = ScrollTrigger.create({
        trigger: section,
        start: 'top 55%',
        end: 'bottom 55%',
        onEnter: () => this.setActiveChapter(chapterNum),
        onEnterBack: () => this.setActiveChapter(chapterNum)
      });
      this.triggers.push(railTrigger);

      if (!this.prefersReducedMotion) {
        const revealItems = section.querySelectorAll('.reveal-item');
        if (revealItems.length > 0) {
          gsap.fromTo(
            revealItems,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              stagger: 0.12,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: section,
                start: 'top 65%',
                toggleActions: 'play none none reverse'
              }
            }
          );
        }
      }
    });

    // 2. Coordinated Scroll-Driven Transformations Across the 7 Chapters
    // Transition 1 -> 2: Origin to Structure
    // Sculpture moves to right-side macro framing (1.35, camera dives to 6.2)
    const t12 = ScrollTrigger.create({
      trigger: '#chapter-01',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const heroContent = document.querySelector('.hero-layout');
        const heroIndicator = document.querySelector('.hero-scroll-indicator');
        if (heroContent) {
          heroContent.style.opacity = Math.max(0, 1 - p * 1.8);
          heroContent.style.transform = `translateY(${p * -40}px)`;
        }
        if (heroIndicator) {
          heroIndicator.style.opacity = Math.max(0, 1 - p * 2.5);
        }

        const scX = gsap.utils.interpolate(1.25, 1.35, p);
        const scY = gsap.utils.interpolate(0.0, 0.1, p);
        const camZ = gsap.utils.interpolate(7.8, 6.2, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(2.0, 2.5, p),
          rimIntensity: gsap.utils.interpolate(3.4, 3.0, p),
          coreIntensity: gsap.utils.interpolate(1.8, 1.6, p)
        });

        sculpture.setChapterWeights({
          tension: p * 0.15,
          dissolution: 0,
          reformation: 0,
          immediate: true
        });
      }
    });
    this.triggers.push(t12);

    // Transition 2 -> 3: Structure to Tension
    // Sculpture shifts to the left side (-1.6), camera pulls back to 7.2
    const t23 = ScrollTrigger.create({
      trigger: '#chapter-02',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const scX = gsap.utils.interpolate(1.35, -1.65, p);
        const scY = gsap.utils.interpolate(0.1, -0.1, p);
        const camZ = gsap.utils.interpolate(6.2, 7.2, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(2.5, 2.2, p),
          rimIntensity: gsap.utils.interpolate(3.0, 4.2, p),
          coreIntensity: gsap.utils.interpolate(1.6, 2.2, p)
        });

        const tensionVal = gsap.utils.interpolate(0.15, 1.0, p);
        sculpture.setChapterWeights({
          tension: tensionVal,
          dissolution: 0,
          reformation: 0,
          immediate: true
        });
      }
    });
    this.triggers.push(t23);

    // Transition 3 -> 4: Tension to Dissolution
    // Sculpture shifts back to the right (1.25), text on the left
    const t34 = ScrollTrigger.create({
      trigger: '#chapter-03',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const scX = gsap.utils.interpolate(-1.35, 1.25, p);
        const scY = gsap.utils.interpolate(-0.1, 0.2, p);
        const camZ = gsap.utils.interpolate(6.6, 7.5, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(2.2, 1.8, p),
          rimIntensity: gsap.utils.interpolate(4.2, 3.8, p),
          coreIntensity: gsap.utils.interpolate(2.2, 3.0, p)
        });

        const dissVal = p;
        const tensionVal = gsap.utils.interpolate(1.0, 0.4, p);
        sculpture.setChapterWeights({
          tension: tensionVal,
          dissolution: dissVal,
          reformation: 0,
          immediate: true
        });
      }
    });
    this.triggers.push(t34);

    // Transition 4 -> 5: Dissolution to Reformation
    // Sculpture shifts to the left (-1.25), text on the right
    const t45 = ScrollTrigger.create({
      trigger: '#chapter-04',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const scX = gsap.utils.interpolate(1.25, -1.25, p);
        const scY = gsap.utils.interpolate(0.2, -0.1, p);
        const camZ = gsap.utils.interpolate(7.5, 7.5, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(1.8, 2.4, p),
          rimIntensity: gsap.utils.interpolate(3.8, 3.2, p),
          coreIntensity: gsap.utils.interpolate(3.0, 2.0, p)
        });

        const dissVal = 1.0 - p;
        const refVal = p;
        sculpture.setChapterWeights({
          tension: 0,
          dissolution: dissVal,
          reformation: refVal,
          immediate: true
        });
      }
    });
    this.triggers.push(t45);

    // Transition 5 -> 6: Reformation to Playground
    // Sculpture positions in upper right (1.15, 0.35), studio panel sits on the left
    const t56 = ScrollTrigger.create({
      trigger: '#chapter-05',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const scX = gsap.utils.interpolate(-1.25, 1.15, p);
        const scY = gsap.utils.interpolate(-0.1, 0.35, p);
        const camZ = gsap.utils.interpolate(7.5, 7.8, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(2.4, 2.0, p),
          rimIntensity: gsap.utils.interpolate(3.2, 3.4, p),
          coreIntensity: gsap.utils.interpolate(2.0, 1.8, p)
        });
      }
    });
    this.triggers.push(t56);

    // Transition 6 -> 7: Playground to Continuation
    // Sculpture moves to upper center (0.0, 0.85), camera pulls back to 8.6
    const t67 = ScrollTrigger.create({
      trigger: '#chapter-06',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        const scX = gsap.utils.interpolate(1.15, 0.0, p);
        const scY = gsap.utils.interpolate(0.35, 0.85, p);
        const camZ = gsap.utils.interpolate(7.8, 8.6, p);

        this.sceneManager.setSculptureFramingOffset(scX, scY);
        this.sceneManager.setCameraTarget(0, 0, camZ);
        this.sceneManager.setLightingState({
          keyIntensity: gsap.utils.interpolate(2.0, 1.6, p),
          rimIntensity: gsap.utils.interpolate(3.4, 3.0, p),
          coreIntensity: gsap.utils.interpolate(1.8, 2.4, p)
        });
      }
    });
    this.triggers.push(t67);

    // Scroll listener for dynamic frosted header state
    this.handleScroll = () => {
      const header = document.querySelector('.site-header');
      if (header) {
        header.classList.toggle('is-scrolled', window.scrollY > 40);
      }
    };
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    this.handleScroll();

    ScrollTrigger.refresh();
  }

  setActiveChapter(chapterNum) {
    if (this.currentChapter === chapterNum) return;
    this.currentChapter = chapterNum;

    // 1. Update Desktop Chapter Rail
    const railButtons = document.querySelectorAll('.rail-item');
    railButtons.forEach((btn) => {
      const num = parseInt(btn.dataset.chapter || '1', 10);
      const isActive = num === chapterNum;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    const railIndicator = document.querySelector('.rail-indicator');
    if (railIndicator) {
      const pct = ((chapterNum - 1) / 6) * 100;
      railIndicator.style.top = `${pct}%`;
    }

    const chapterNames = [
      'ORIGIN',
      'STRUCTURE',
      'TENSION',
      'DISSOLUTION',
      'REFORMATION',
      'PLAYGROUND',
      'CONTINUATION'
    ];
    const name = chapterNames[chapterNum - 1] || 'EXPERIENCE';
    const tag = `CH 0${chapterNum} // ${name}`;

    // 2. Update Header Navigation Links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      const navKey = link.dataset.nav;
      let isActive = false;
      if (navKey === 'origin' && chapterNum === 1) isActive = true;
      else if (navKey === 'narrative' && chapterNum >= 2 && chapterNum <= 5) isActive = true;
      else if (navKey === 'playground' && chapterNum === 6) isActive = true;
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // 3. Update Header Chapter Badge
    const navChapterIndicator = document.querySelector('#nav-chapter-indicator');
    if (navChapterIndicator) {
      navChapterIndicator.textContent = tag;
    }

    // 4. Update Mobile / Tablet Chapter Navigation Pill
    const mobileCurrNum = document.querySelector('#mobile-curr-num');
    const mobileCurrName = document.querySelector('#mobile-curr-name');
    if (mobileCurrNum) mobileCurrNum.textContent = `0${chapterNum}`;
    if (mobileCurrName) mobileCurrName.textContent = name;

    // 5. Dismiss Discovery Hint if user scrolled past Chapter 01
    if (chapterNum > 1) {
      const hint = document.querySelector('#drag-discovery-hint');
      if (hint && !hint.classList.contains('is-dismissed')) {
        hint.classList.add('is-dismissed');
      }
    }

    const telemetryChapter = document.querySelector('#telemetry-chapter');
    if (telemetryChapter) {
      telemetryChapter.textContent = tag;
    }

    if (this.onChapterChange) {
      this.onChapterChange(chapterNum, name);
    }
  }

  nextChapter() {
    if (this.currentChapter < 7) {
      this.scrollToChapter(this.currentChapter + 1);
    }
  }

  prevChapter() {
    if (this.currentChapter > 1) {
      this.scrollToChapter(this.currentChapter - 1);
    }
  }

  scrollToChapter(chapterNum) {
    const section = document.querySelector(`#chapter-0${chapterNum}`);
    if (!section) return;

    section.scrollIntoView({
      behavior: this.prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  returnToOrigin() {
    const origin = document.querySelector('#chapter-01');
    if (!origin) return;

    if (this.sceneManager?.sculpture) {
      this.sceneManager.sculpture.triggerPulse(1.5);
    }

    origin.scrollIntoView({
      behavior: this.prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  dispose() {
    if (this.handleScroll) {
      window.removeEventListener('scroll', this.handleScroll);
    }
    this.triggers.forEach((trigger) => trigger.kill());
    this.triggers = [];
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }
}

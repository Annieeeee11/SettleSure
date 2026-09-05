import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLandingAnimations(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (!root.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(".sc-stack", { opacity: 1, scale: 0.76, rotateY: 0, rotateX: 0, y: 0, xPercent: 0 });
      gsap.set(".sc-layer-1", { x: -82, z: -160, rotateY: 6 });
      gsap.set(".sc-layer-2", { x: -40, z: -80, rotateY: 3 });
      gsap.set(".sc-layer-4", { x: 42, z: 80, rotateY: -3 });
      gsap.set(".sc-layer-5", { x: 84, z: 160, rotateY: -6 });
      gsap.set(".sc-stack-intro", { opacity: 0.95 });
      gsap.set(".sc-stack-matches", { opacity: 0 });
      gsap.set(".sc-stack-exceptions", { opacity: 0 });
      gsap.set(".sc-story-intro", { opacity: 1, y: 0 });
      gsap.set(".sc-story-app", { opacity: 0 });
      gsap.set(".sc-story-data", { opacity: 0 });
      return;
    }

    const context = gsap.context(() => {
      gsap.from(".sc-hero-title span", {
        yPercent: 110,
        opacity: 0,
        duration: 1.15,
        stagger: 0.1,
        ease: "power4.out",
        delay: 0.15,
      });
      gsap.from(".sc-hero-media", {
        y: 40,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        delay: 0.25,
      });

      // Fully fanned + intro visible as soon as the section pins.
      gsap.set(".sc-stack", {
        opacity: 1,
        scale: 0.76,
        rotateY: 0,
        rotateX: 0,
        y: 0,
        xPercent: 0,
      });
      gsap.set(".sc-layer-1", { x: -82, z: -160, rotateY: 6 });
      gsap.set(".sc-layer-2", { x: -40, z: -80, rotateY: 3 });
      gsap.set(".sc-layer-3", { x: 0, z: 0, rotateY: 0 });
      gsap.set(".sc-layer-4", { x: 42, z: 80, rotateY: -3 });
      gsap.set(".sc-layer-5", { x: 84, z: 160, rotateY: -6 });
      gsap.set(".sc-stack-intro", { opacity: 0.95 });
      gsap.set(".sc-stack-matches", { opacity: 0 });
      gsap.set(".sc-stack-exceptions", { opacity: 0 });
      gsap.set(".sc-story-intro", { opacity: 1, y: 0 });
      gsap.set(".sc-story-app", { opacity: 0, y: 24 });
      gsap.set(".sc-story-data", { opacity: 0, y: 24 });

      const story = gsap.timeline({
        scrollTrigger: {
          trigger: ".sc-story",
          // Wait until the sticky frame fills the viewport — don't scrub while still below the fold.
          start: "top top",
          end: "bottom bottom",
          scrub: 0.55,
        },
      });

      story
        // Beat 1 — hold ingest long enough to read
        .to({}, { duration: 1.1 })
        // Beat 1 → 2
        .to(".sc-story-intro", { opacity: 0, y: -20, duration: 0.35 }, ">")
        .to(".sc-stack", { xPercent: 32, rotateY: -10, scale: 0.74, duration: 0.55 }, "<")
        .to(".sc-stack-intro", { opacity: 0, duration: 0.3 }, "<0.05")
        .to(".sc-stack-matches", { opacity: 0.95, duration: 0.35 }, "<0.1")
        .to(".sc-story-app", { opacity: 1, y: 0, duration: 0.35 }, "<0.12")
        // Beat 2 — hold workflow
        .to({}, { duration: 1.1 })
        // Beat 2 → 3
        .to(".sc-story-app", { opacity: 0, y: -20, duration: 0.35 }, ">")
        .to(".sc-stack", { xPercent: -32, rotateY: 10, scale: 0.72, duration: 0.55 }, "<")
        .to(".sc-stack-matches", { opacity: 0, duration: 0.3 }, "<0.05")
        .to(".sc-stack-exceptions", { opacity: 0.95, duration: 0.35 }, "<0.1")
        .to(".sc-story-data", { opacity: 1, y: 0, duration: 0.35 }, "<0.12")
        // Beat 3 — hold review through the end of the section
        .to({}, { duration: 1.1 });

      gsap.utils.toArray<HTMLElement>(".sc-reveal").forEach((element) => {
        gsap.from(element, {
          y: 60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 86%" },
        });
      });
    }, root);

    return () => context.revert();
  }, [root]);
}

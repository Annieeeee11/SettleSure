import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLandingAnimations(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (!root.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(".sc-stack", { opacity: 1, scale: 0.94, rotateY: -7, rotateX: 2, y: -58 });
      gsap.set(".sc-layer-1", { x: -110, z: -210, rotateY: 7 });
      gsap.set(".sc-layer-2", { x: -54, z: -105, rotateY: 3 });
      gsap.set(".sc-layer-4", { x: 56, z: 105, rotateY: -3 });
      gsap.set(".sc-layer-5", { x: 112, z: 210, rotateY: -7 });
      gsap.set(".sc-story-intro", { opacity: 1, y: 0 });
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

      // Black page first — stack stays hidden until the story pin starts.
      gsap.set(".sc-stack", {
        opacity: 0,
        scale: 0.86,
        rotateY: -3,
        rotateX: 1,
        y: -40,
        xPercent: 0,
      });
      gsap.set(".sc-layer-1", { x: -28, z: -90, rotateY: 3 });
      gsap.set(".sc-layer-2", { x: -12, z: -45, rotateY: 1.5 });
      gsap.set(".sc-layer-3", { x: 0, z: 0, rotateY: 0 });
      gsap.set(".sc-layer-4", { x: 12, z: 45, rotateY: -1.5 });
      gsap.set(".sc-layer-5", { x: 28, z: 90, rotateY: -3 });
      gsap.set(".sc-story-intro", { opacity: 0, y: 30 });
      gsap.set(".sc-story-app", { opacity: 0, y: 30 });
      gsap.set(".sc-story-data", { opacity: 0, y: 30 });

      const story = gsap.timeline({
        scrollTrigger: {
          trigger: ".sc-story",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.35,
        },
      });

      // Near-zero duration = instant pop on the first scroll tick into the pin.
      story
        .fromTo(
          ".sc-stack",
          { opacity: 0, scale: 0.86, rotateY: -3, rotateX: 1, y: -40 },
          { opacity: 1, scale: 0.94, rotateY: -7, rotateX: 2, y: -58, duration: 0.02, ease: "none" },
          0,
        )
        .fromTo(".sc-layer-1", { x: -28, z: -90, rotateY: 3 }, { x: -110, z: -210, rotateY: 7, duration: 0.02, ease: "none" }, 0)
        .fromTo(".sc-layer-2", { x: -12, z: -45, rotateY: 1.5 }, { x: -54, z: -105, rotateY: 3, duration: 0.02, ease: "none" }, 0)
        .fromTo(".sc-layer-4", { x: 12, z: 45, rotateY: -1.5 }, { x: 56, z: 105, rotateY: -3, duration: 0.02, ease: "none" }, 0)
        .fromTo(".sc-layer-5", { x: 28, z: 90, rotateY: -3 }, { x: 112, z: 210, rotateY: -7, duration: 0.02, ease: "none" }, 0)
        .fromTo(".sc-story-intro", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08, ease: "none" }, 0.02)
        .to(".sc-story-intro", { opacity: 0, y: -24, duration: 0.22 }, 0.55)
        .to(".sc-stack", { xPercent: 31, rotateY: -14, scale: 0.9, y: -12, duration: 0.9 }, 0.6)
        .to(".sc-stack-street", { opacity: 0, duration: 0.3 }, 0.68)
        .to(".sc-stack-people", { opacity: 0.76, duration: 0.35 }, 0.75)
        .to(".sc-story-app", { opacity: 1, y: 0, duration: 0.32 }, 0.88)
        .to(".sc-story-app", { opacity: 0, y: -24, duration: 0.22 }, 1.55)
        .to(".sc-stack", { xPercent: -38, rotateY: 14, scale: 0.88, y: 0, duration: 0.95 }, 1.6)
        .to(".sc-stack-people", { opacity: 0, duration: 0.3 }, 1.66)
        .to(".sc-stack-dashboard", { opacity: 0.66, duration: 0.4 }, 1.74)
        .to(".sc-story-data", { opacity: 1, y: 0, duration: 0.34 }, 1.86);

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

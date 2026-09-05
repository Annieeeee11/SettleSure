import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLandingAnimations(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (!root.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(".sc-stack", { opacity: 1, scale: 0.78, rotateY: 0, rotateX: 0, y: 0 });
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

      gsap.set(".sc-stack", {
        opacity: 0,
        scale: 0.68,
        rotateY: 0,
        rotateX: 0,
        y: 90,
        xPercent: 0,
      });
      gsap.set(".sc-layer-1", { x: 0, z: -8, rotateY: 0 });
      gsap.set(".sc-layer-2", { x: 0, z: -4, rotateY: 0 });
      gsap.set(".sc-layer-3", { x: 0, z: 0, rotateY: 0 });
      gsap.set(".sc-layer-4", { x: 0, z: 4, rotateY: 0 });
      gsap.set(".sc-layer-5", { x: 0, z: 8, rotateY: 0 });
      gsap.set(".sc-story-intro", { opacity: 0, y: 30 });
      gsap.set(".sc-story-app", { opacity: 0, y: 30 });
      gsap.set(".sc-story-data", { opacity: 0, y: 30 });

      const story = gsap.timeline({
        scrollTrigger: {
          trigger: ".sc-story",
          start: "top 82%",
          end: "bottom bottom",
          scrub: 0.35,
        },
      });

      story
        .fromTo(
          ".sc-stack",
          { opacity: 0, scale: 0.68, rotateY: 0, rotateX: 0, y: 90 },
          { opacity: 1, scale: 0.78, rotateY: 0, rotateX: 0, y: 0, duration: 0.18, ease: "power2.out" },
          0,
        )
        .fromTo(".sc-layer-1", { x: 0, z: -8, rotateY: 0 }, { x: -82, z: -160, rotateY: 6, duration: 0.22, ease: "power2.out" }, 0.14)
        .fromTo(".sc-layer-2", { x: 0, z: -4, rotateY: 0 }, { x: -40, z: -80, rotateY: 3, duration: 0.22, ease: "power2.out" }, 0.14)
        .fromTo(".sc-layer-4", { x: 0, z: 4, rotateY: 0 }, { x: 42, z: 80, rotateY: -3, duration: 0.22, ease: "power2.out" }, 0.14)
        .fromTo(".sc-layer-5", { x: 0, z: 8, rotateY: 0 }, { x: 84, z: 160, rotateY: -6, duration: 0.22, ease: "power2.out" }, 0.14)
        .fromTo(".sc-story-intro", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.16, ease: "none" }, 0.14)
        .to(".sc-story-intro", { opacity: 0, y: -24, duration: 0.2 }, 0.48)
        .to(".sc-stack", { xPercent: 34, rotateY: -11, scale: 0.74, y: 0, duration: 0.72 }, 0.52)
        .to(".sc-stack-street", { opacity: 0, duration: 0.3 }, 0.68)
        .to(".sc-stack-people", { opacity: 0.76, duration: 0.35 }, 0.75)
        .to(".sc-story-app", { opacity: 1, y: 0, duration: 0.32 }, 0.88)
        .to(".sc-story-app", { opacity: 0, y: -24, duration: 0.22 }, 1.55)
        .to(".sc-stack", { xPercent: -34, rotateY: 11, scale: 0.72, y: 0, duration: 0.85 }, 1.6)
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

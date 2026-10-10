import React, { useEffect, useRef, useState } from "https://esm.sh/react@19.1.1";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?deps=react@19.1.1";
import { motion, useReducedMotion } from "https://esm.sh/framer-motion@13.4.5?deps=react@19.1.1,react-dom@19.1.1";

function RevealImage({ src, alt, loading = "lazy", threshold = 0.2, rootMargin = "0px 0px -8% 0px" }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setIsVisible(true);
      return undefined;
    }

    const element = containerRef.current;
    if (!element || isVisible) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { threshold, rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible, reduceMotion, threshold, rootMargin]);

  const revealed = reduceMotion || isVisible;
  const clipPath = revealed ? "inset(0% 0 0 0)" : "inset(100% 0 0 0)";

  return React.createElement(
    motion.div,
    {
      ref: containerRef,
      className: "reveal-image-frame",
      initial: false,
      animate: { clipPath },
      transition: { duration: reduceMotion ? 0 : 0.8, ease: "easeOut" },
      style: {
        clipPath,
        WebkitClipPath: clipPath,
        willChange: reduceMotion ? undefined : "clip-path",
      },
    },
    React.createElement("img", { src, alt, loading, decoding: "async" }),
  );
}

function mountRevealImages() {
  const mounts = document.querySelectorAll("[data-reveal-image]");

  mounts.forEach((mount) => {
    const fallback = mount.querySelector("img");
    const props = {
      src: mount.dataset.src || fallback?.currentSrc || fallback?.src || "",
      alt: mount.dataset.alt || fallback?.alt || "",
      loading: mount.dataset.loading || fallback?.loading || "lazy",
    };

    if (!props.src) return;

    mount.replaceChildren();
    createRoot(mount).render(React.createElement(RevealImage, props));
  });
}

mountRevealImages();

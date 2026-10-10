import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

// Fonte do componente RevealImage. O arquivo publicado é gerado por
// `npm run build` em tools/ e fica em assets/js/reveal-image.js.
function RevealImage({ src, alt, width, height, sizes, loading = "lazy", threshold = 0.2, rootMargin = "0px 0px -8% 0px" }) {
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
    m.div,
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
    React.createElement("img", { src, alt, width, height, sizes, loading, decoding: "async" }),
  );
}

function mountRevealImages() {
  const mounts = document.querySelectorAll("[data-reveal-image]");

  mounts.forEach((mount) => {
    const fallback = mount.querySelector("img");
    const props = {
      src: mount.dataset.src || fallback?.currentSrc || fallback?.src || "",
      alt: mount.dataset.alt || fallback?.alt || "",
      width: fallback?.getAttribute("width") || undefined,
      height: fallback?.getAttribute("height") || undefined,
      loading: mount.dataset.loading || fallback?.loading || "lazy",
    };

    if (!props.src) return;

    mount.replaceChildren();
    mount.classList.add("is-mounted");
    createRoot(mount).render(
      React.createElement(LazyMotion, { features: domAnimation, strict: true }, React.createElement(RevealImage, props)),
    );
  });
}

mountRevealImages();

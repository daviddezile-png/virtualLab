import { useState, useEffect } from "react";

export function useWindowSize() {
  const [size, setSize] = useState({
    width:  window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handler = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    width:  size.width,
    height: size.height,
    isMobile:  size.width < 640,
    isTablet:  size.width >= 640  && size.width < 1024,
    isLaptop:  size.width >= 1024 && size.width < 1440,
    isDesktop: size.width >= 1440,
    isWide:    size.width >= 1920,
  };
}

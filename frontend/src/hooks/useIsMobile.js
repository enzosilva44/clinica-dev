import { useEffect, useState } from "react";

// Detecta viewport mobile. No app nativo (Capacitor), a tela pequena já
// resolve; se um dia precisarmos forçar por plataforma, dá pra combinar com
// Capacitor.getPlatform() aqui num único lugar.
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    // addEventListener é o padrão moderno; fallback p/ navegadores antigos
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    setIsMobile(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

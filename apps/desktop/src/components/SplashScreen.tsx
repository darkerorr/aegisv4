import { motion } from "framer-motion";
import logoUrl from "../assets/aegis-logo.png";

export function SplashScreen() {
  return <main className="splash-screen" aria-label="Aegis is starting"><motion.div className="splash-halo" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7 }} /><motion.img src={logoUrl} alt="Aegis" initial={{ opacity: 0, scale: .82, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: .55, ease: [0.2, .8, .2, 1] }} /><motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16, duration: .34 }}>Aegis</motion.h1><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 }}>Restoring your secure workspace</motion.p><span className="splash-progress"><i /></span></main>;
}

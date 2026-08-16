"use client";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Braces, Check, ChevronDown, Globe2, LibraryBig, Paperclip, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { AegisLogo } from "@/components/brand/aegis-logo";
import { ProviderIcon } from "@/components/brand/provider-icon";

const ANSWERS = [
  {
    title: "J'ai identifié trois angles de positionnement.",
    copy: "Vos recherches valorisent surtout la liberté de choix des providers, mais le plan actuel met en avant le nombre de modèles. Mettons plutôt en avant le contrôle.",
  },
  {
    title: "L'angle le plus fort : le choix protégé.",
    copy: "Aegis est le workspace qui permet de choisir une IA locale ou cloud, tâche par tâche — sans fragmenter ses outils ni son contexte.",
  },
  {
    title: "Voici la narration de lancement affinée.",
    copy: "Tous vos modèles d'IA. Une seule interface. Orchestrez les modèles locaux, le raisonnement cloud et vos outils connectés dans un flux unique et délibéré.",
  },
];

export function ChatDemo() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setStep((v) => (v + 1) % ANSWERS.length), 2600);
    return () => clearInterval(id);
  }, [reduced]);
  return (
    <MotionConfig reducedMotion="user">
      <div className="chat-demo light-sweep">
      <div className="demo-top">
        <span className="flex items-center gap-2"><i /><i /><i /></span>
        <span className="mono text-[11px] text-zinc-500">WORKSPACE PRIVÉ / BRIEF PRODUIT</span>
        <span className="demo-model"><ProviderIcon provider="anthropic" variant="color" size={16} />Claude 4 <ChevronDown size={13} /></span>
      </div>
      <div className="demo-body">
        <div className="demo-rail"><AegisLogo size={25} /><span /><span /><span /></div>
        <div className="demo-conversation">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} className="demo-user">Compare notre plan de lancement aux recherches dans Drive, puis propose un positionnement plus net.</motion.div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="demo-answer">
              <div className="flex items-center gap-2 text-xs text-zinc-500"><AegisLogo size={20} /><strong className="text-zinc-300">Aegis</strong><span>·</span><span>Claude 4</span></div>
              <h3>{ANSWERS[step].title}</h3>
              <p>{ANSWERS[step].copy}</p>
              <div className="demo-sources"><span><LibraryBig size={13} /> 4 sources</span><span><Globe2 size={13} /> Recherche</span><span><Check size={13} /> Vérifié</span></div>
            </motion.div>
          </AnimatePresence>
          <div className="demo-composer">
            <span className="text-zinc-600">Demande à Aegis…</span>
            <div className="flex items-center gap-1">
              <span className="demo-provider-strip">
                {["nvidia", "openai", "openrouter", "ollama", "groq"].map((p) => <ProviderIcon key={p} provider={p} variant="color" size={16} />)}
              </span>
              <Paperclip size={17} /><Wrench size={17} />
              <button aria-label="Envoyer"><ArrowUp size={17} /></button>
            </div>
          </div>
        </div>
        <aside className="demo-context">
          <span className="eyebrow">Contexte</span>
          <div><Braces size={16} /><p>launch-plan.md<small>Projet</small></p></div>
          <div><Sparkles size={16} /><p>Étude de marché<small>Google Drive</small></p></div>
        </aside>
      </div>
    </div>
    </MotionConfig>
  );
}
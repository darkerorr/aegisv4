import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useSettings } from "../contexts/SettingsContext";
import logoUrl from "../assets/aegis-logo.png";

type Choice = "online" | "local" | "key" | "later";

const models = [
  { name: "DeepSeek V4", detail: "Fast and powerful", provider: "NVIDIA", tag: "Online" },
  { name: "Qwen Coder", detail: "Best for programming", provider: "Ollama", tag: "Local" },
  { name: "Llama", detail: "Private and local", provider: "Ollama", tag: "Local" },
];

export function OnboardingPage() {
  const { goLocal } = useAuth();
  const { navigate } = useSidebar();
  const { setAnimations } = useSettings();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [model, setModel] = useState(models[0].name);

  function finish() {
    setAnimations(true);
    try { localStorage.setItem("aegis-onboarding-complete", "1"); } catch { /* storage may be restricted */ }
    if (choice === "online" || choice === "key") {
      navigate("Login");
      return;
    }
    goLocal();
    navigate("Chat");
  }

  return (
    <div className="onboarding-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <motion.div className="panel" style={{ width: "min(100%, 620px)", padding: "36px 34px", borderRadius: 28 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <img src={logoUrl} alt="Aegis" width={42} height={42} />
          <div><strong>Aegis</strong><p className="muted" style={{ margin: "3px 0 0", fontSize: 12 }}>A simple AI chat for everyone</p></div>
        </div>
        <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,.08)", marginBottom: 30 }}><motion.div style={{ height: "100%", borderRadius: 99, background: "var(--aegis-gradient-primary)" }} animate={{ width: `${((step + 1) / 4) * 100}%` }} /></div>

        {step === 0 && <div><p className="eyebrow">Welcome</p><h1 style={{ fontSize: 34, margin: "8px 0 10px" }}>Welcome to Aegis</h1><p className="muted" style={{ lineHeight: 1.7, fontSize: 15 }}>Choose how you want to use AI. You can change this later.</p></div>}

        {step === 1 && <div><p className="eyebrow">Step 2 of 4</p><h2 style={{ margin: "8px 0 18px" }}>Choose your experience</h2><div style={{ display: "grid", gap: 10 }}>
          {([
            ["online", "Use Aegis online", "Sign in to sync conversations across devices."],
            ["local", "Use local models", "Private conversations with Ollama or LM Studio."],
            ["key", "I already have an API key", "Connect NVIDIA, OpenRouter or another service."],
            ["later", "Configure later", "Start with Aegis and choose a model when ready."],
          ] as [Choice, string, string][]).map(([value, title, detail]) => <button key={value} className={`aegis-btn ${choice === value ? "aegis-btn-primary" : "aegis-btn-secondary"}`} onClick={() => setChoice(value)} style={{ justifyContent: "flex-start", textAlign: "left", padding: "15px 17px" }}><span><strong>{title}</strong><small style={{ display: "block", opacity: .72, marginTop: 4 }}>{detail}</small></span></button>)}
        </div></div>}

        {step === 2 && <div><p className="eyebrow">Step 3 of 4</p><h2 style={{ margin: "8px 0 8px" }}>Choose a recommended model</h2><p className="muted">You can switch models any time in Chat.</p><div style={{ display: "grid", gap: 10, marginTop: 18 }}>{models.map((item) => <button key={item.name} className={`aegis-btn ${model === item.name ? "aegis-btn-primary" : "aegis-btn-secondary"}`} onClick={() => setModel(item.name)} style={{ justifyContent: "space-between", textAlign: "left", padding: "14px 16px" }}><span><strong>{item.name}</strong><small style={{ display: "block", opacity: .72, marginTop: 4 }}>{item.detail} · {item.provider}</small></span><span className="badge">{item.tag}</span></button>)}</div></div>}

        {step === 3 && <div><p className="eyebrow">Step 4 of 4</p><h2 style={{ margin: "8px 0 10px" }}>You are ready to chat</h2><p className="muted" style={{ lineHeight: 1.7 }}>Your first choice is <strong>{model}</strong>. Aegis will take you to the Chat screen next. Technical settings stay available under Settings → Advanced.</p>{choice === "local" && <p className="aegis-alert aegis-alert-success" style={{ marginTop: 18 }}>Local mode keeps conversations on this device.</p>}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 30 }}>
          <button className="aegis-btn aegis-btn-ghost" onClick={() => step === 0 ? navigate("Login") : setStep((value) => value - 1)}>{step === 0 ? "Already have an account? Sign in" : "Back"}</button>
          {step < 3 ? <button className="aegis-btn aegis-btn-primary" disabled={step === 1 && !choice} onClick={() => setStep((value) => value + 1)}>Continue</button> : <button className="aegis-btn aegis-btn-primary" onClick={finish}>Open Chat</button>}
        </div>
      </motion.div>
    </div>
  );
}

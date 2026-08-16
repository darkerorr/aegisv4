import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import logoUrl from "../assets/aegis-logo.png";

export function WelcomePage() {
  const { goLocal } = useAuth();
  const { navigate } = useSidebar();

  return (
    <motion.div
      className="welcome-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        textAlign: "center",
        padding: 40,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="welcome-glow"
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "var(--aegis-gradient-glow)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <img src={logoUrl} alt="Aegis" width={80} height={80} style={{ marginBottom: 24 }} />
      </motion.div>

      <motion.h1
        className="welcome-title"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{ fontSize: 56, fontWeight: 700, margin: 0, letterSpacing: "-0.04em" }}
      >
        Aegis
      </motion.h1>

      <motion.p
        className="welcome-subtitle"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{ fontSize: 18, color: "var(--aegis-text-muted)", maxWidth: 480, marginTop: 12, lineHeight: 1.6 }}
      >
        A simple AI chat for writing, thinking, coding and private local models.
      </motion.p>

      <motion.div
        className="welcome-actions"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}
      >
        <button
          className="aegis-btn aegis-btn-primary aegis-btn-lg"
          onClick={() => navigate("Login")}
          style={{ minWidth: 180 }}
        >
          Sign in
        </button>
        <button
          className="aegis-btn aegis-btn-secondary aegis-btn-lg"
          onClick={() => navigate("Register")}
          style={{ minWidth: 180 }}
        >
          Create account
        </button>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ marginTop: 20 }}
      >
        <button
          className="aegis-btn aegis-btn-ghost"
          onClick={() => {
            goLocal();
            navigate("Chat");
          }}
          style={{ color: "var(--aegis-text-muted)", fontSize: 14 }}
        >
          Continue without account — local mode
        </button>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }} style={{ marginTop: 14 }}>
        <button className="aegis-btn aegis-btn-ghost" onClick={() => navigate("Onboarding")} style={{ fontSize: 13 }}>
          Get started with a quick setup
        </button>
      </motion.div>
    </motion.div>
  );
}

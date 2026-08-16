import { Fingerprint, History, Network, ShieldCheck } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export default function PrivacySettings() {
  return <WorkspacePage title="Privacy" description="Understand what leaves the workspace and when." icon={Fingerprint}>
    <div className="aegis-settings-stack">
      <section className="aegis-settings-panel">
        <header><ShieldCheck size={18} /><div><h2>Execution boundary</h2><p>The composer labels local or cloud execution using the selected model&apos;s provider.</p></div></header>
        <div className="setting-facts">
          <span><Network size={16} />No provider is selected silently.</span>
          <span><History size={16} />Conversation history is stored by the authenticated Aegis API.</span>
        </div>
      </section>
      <section className="aegis-settings-panel">
        <header><Fingerprint size={18} /><div><h2>Connected permissions</h2><p>Review Google scopes and connection state on the Connections page. Missing permission states remain visible.</p></div></header>
      </section>
    </div>
  </WorkspacePage>;
}

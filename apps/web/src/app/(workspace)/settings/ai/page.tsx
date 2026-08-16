import Link from "next/link";
import { BrainCircuit, Cloud, Cpu, Laptop } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export default function Ai() {
  return <WorkspacePage title="AI preferences" description="Choose how model selection behaves in your workspace." icon={BrainCircuit}>
    <div className="aegis-settings-stack">
      <section className="aegis-settings-panel">
        <header><Cpu size={18} /><div><h2>Model availability</h2><p>Aegis only presents models returned by enabled providers.</p></div></header>
        <div className="setting-facts">
          <span><Laptop size={16} />Local models are labeled before use.</span>
          <span><Cloud size={16} />Cloud providers remain explicit in the composer.</span>
        </div>
        <div><Link className="aegis-btn" href="/workspace/models"><Cpu size={14} />Manage models</Link></div>
      </section>
      <section className="aegis-settings-panel">
        <header><BrainCircuit size={18} /><div><h2>Automatic routing</h2><p>Automatic cross-provider routing is disabled. You choose the model for each conversation.</p></div></header>
      </section>
    </div>
  </WorkspacePage>;
}

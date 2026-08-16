import { HardDrive } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { LocalAgentSettings } from "@/features/settings/local-agent-settings";

export default function LocalAgentSettingsPage() {
  return <WorkspacePage title="Local Agent" description="Connect Work Mode to the agent running on this machine." icon={HardDrive}>
    <LocalAgentSettings />
  </WorkspacePage>;
}

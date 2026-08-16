import { ShieldCheck } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { SecuritySettings } from "@/features/settings/security-settings";
export default function AccountSecurity(){return <WorkspacePage title="Security" description="Password and authenticated access." icon={ShieldCheck}><div className="aegis-settings-stack"><SecuritySettings/></div></WorkspacePage>}

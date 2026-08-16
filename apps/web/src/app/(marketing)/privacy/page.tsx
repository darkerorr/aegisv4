import { PrivacyExperience } from "@/components/legal/privacy-experience";
import { getLegalConfig } from "@/lib/legal/config";

export const metadata = { title: "Privacy", description: "See when Aegis uses local runtimes, cloud providers and connected tools, then read the draft privacy policy." };

export default function PrivacyPage() {
  return <PrivacyExperience legal={getLegalConfig()} />;
}

import manifest from "@/../public/releases/release-manifest.json";
import { DownloadExperience } from "@/components/marketing/download-experience";

export const metadata = {
  title: "Download Aegis",
  description: "Install the verified Aegis Desktop build for Windows or set up the Aegis CLI.",
};

export default function DownloadPage() {
  return <DownloadExperience release={manifest.current} />;
}

"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  FileCheck2,
  HardDrive,
  Laptop,
  MemoryStick,
  MonitorDown,
  PackageOpen,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

type ReleaseArtifact = {
  status: string;
  installerType: string;
  filename?: string;
  architecture?: string;
  sizeBytes?: number;
  sha256?: string;
  signed?: boolean;
  downloadUrl: string | null;
  builtAt?: string;
};

type Release = {
  version: string;
  releasedAt: string | null;
  channel: string;
  notes: string[];
  platforms: { "windows-x64": { recommended: string; artifacts: { nsis: ReleaseArtifact; msi: ReleaseArtifact; portable: ReleaseArtifact } } };
};

function bytes(value?: number) {
  if (!value) return "Size unavailable";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function date(value?: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function CopyCommand({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <button className="copy-command" type="button" onClick={() => void copy()} aria-label={`${label}: ${value}`}>
    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    <span>{copied ? "Copied" : label}</span>
  </button>;
}

function InstallerCard({ artifact, recommended = false }: { artifact: ReleaseArtifact; recommended?: boolean }) {
  const available = artifact.status === "available" && Boolean(artifact.downloadUrl);
  return <article className="installer-card" data-recommended={recommended}>
    <header>
      <span className="installer-icon"><PackageOpen size={23} aria-hidden="true" /></span>
      <div><small>{recommended ? "Recommended installer" : "Alternative installer"}</small><h3>{artifact.installerType}</h3></div>
      <span className={`release-state ${available ? "available" : "unavailable"}`}>{available ? "Available" : "Unavailable"}</span>
    </header>
    <p>{artifact.installerType === "NSIS" ? "Best for a personal Windows installation with a guided setup." : "A Windows Installer package suitable for managed or repeatable deployments."}</p>
    <dl><div><dt>Architecture</dt><dd>{artifact.architecture ?? "Unknown"}</dd></div><div><dt>Size</dt><dd>{bytes(artifact.sizeBytes)}</dd></div><div><dt>Signature</dt><dd>{artifact.signed ? "Signed" : "Not code-signed"}</dd></div></dl>
    {available ? <a className="button button-primary" href={artifact.downloadUrl ?? undefined} download><Download size={17} aria-hidden="true" /> Download {artifact.installerType}</a> : <button className="button button-secondary" disabled>Development build unavailable</button>}
    {artifact.sha256 && <details className="checksum"><summary><FileCheck2 size={15} aria-hidden="true" /> SHA-256 checksum</summary><code>{artifact.sha256}</code><CopyCommand value={artifact.sha256} label="Copy checksum" /></details>}
  </article>;
}

export function DownloadExperience({ release }: { release: Release }) {
  const [platform, setPlatform] = useState("Windows");
  const windows = release.platforms["windows-x64"];
  const recommended = windows.artifacts[windows.recommended as "nsis" | "msi"];

  useEffect(() => {
    const source =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      "";
    if (/mac/i.test(source)) setPlatform("macOS");
    else if (/linux/i.test(source)) setPlatform("Linux");
    else setPlatform("Windows");
  }, []);

  return <main id="main" className="download-page public-rich-page">
    <section className="download-hero">
      <div className="download-radiance" aria-hidden="true"><span /><i /><b /></div>
      <div className="shell download-hero-grid">
        <div>
          <span className="eyebrow"><MonitorDown size={15} aria-hidden="true" /> Aegis Desktop · development channel</span>
          <h1>Aegis on<br /><span className="chrome-text">your machine.</span></h1>
          <p>Run local models, connect cloud intelligence and keep your workspace close to your files, projects and tools.</p>
          <div className="download-actions">
            {platform === "Windows" && recommended.downloadUrl ? <a className="button button-primary" href={recommended.downloadUrl} download><Download size={18} aria-hidden="true" /> Download for Windows</a> : <a className="button button-primary" href="#installers"><PackageOpen size={18} aria-hidden="true" /> View Windows downloads</a>}
            <a className="button button-secondary" href="#cli"><TerminalSquare size={18} aria-hidden="true" /> Install the CLI</a>
            <a className="text-link" href="#releases">View all releases <ChevronRight size={16} /></a>
          </div>
          <div className="release-facts"><span>Aegis Desktop {release.version}</span><span>Windows 10/11 · x64</span><span>{recommended.installerType} · {bytes(recommended.sizeBytes)}</span><span>{date(release.releasedAt)}</span></div>
          {platform !== "Windows" && <p className="platform-note"><TriangleAlert size={15} /> {platform} was detected. The verified Desktop artifacts in this workspace currently target Windows x64.</p>}
        </div>
        <div className="desktop-product-visual" aria-label="Aegis Desktop interface illustration">
          <div className="desktop-titlebar"><i /><span>Aegis Desktop</span><b>Local</b></div>
          <div className="desktop-mock-body"><aside><span /><span /><span /><span /></aside><section><small>PRIVATE WORKSPACE</small><h2>Work locally.<br />Reach further.</h2><div><span>Ollama · Local</span><span>Connected</span></div></section></div>
          <span className="build-pill"><ShieldCheck size={14} /> Checksummed build</span>
        </div>
      </div>
    </section>

    <section id="installers" className="download-section shell">
      <div className="public-section-heading"><span className="eyebrow">Verified artifacts</span><h2>Choose the installer that fits.</h2><p>The links below point to the exact files represented by the release manifest. The raw Tauri executable is not presented as a portable release.</p></div>
      <div className="installer-grid"><InstallerCard artifact={windows.artifacts.nsis} recommended /><InstallerCard artifact={windows.artifacts.msi} /></div>
      <div className="unsigned-notice"><TriangleAlert size={20} /><div><strong>Development build, not code-signed</strong><p>Windows SmartScreen may warn before opening this build. Verify the SHA-256 value below and only continue when the file came from this Aegis page. Do not disable antivirus protection.</p></div></div>
    </section>

    <section className="download-section install-walkthrough">
      <div className="shell"><div className="public-section-heading"><span className="eyebrow">Windows installation</span><h2>From download to first conversation.</h2></div><ol className="installation-steps">
        {["Download the recommended NSIS installer.","Verify its checksum before opening it.","Follow the Windows setup assistant.","Launch Aegis Desktop from the Start menu.","Sign in, or stay in Local mode and connect Ollama or LM Studio."].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}
      </ol><div className="support-links"><Link href="/docs/desktop/installation-windows">Detailed installation guide <ChevronRight size={15} /></Link><Link href="/docs/desktop/troubleshooting">Desktop troubleshooting <ChevronRight size={15} /></Link><Link href="/docs/desktop/updates">Updates and uninstall <ChevronRight size={15} /></Link></div></div>
    </section>

    <section id="cli" className="download-section cli-install-section"><div className="shell cli-install-grid"><div><span className="eyebrow"><TerminalSquare size={15} /> Command line</span><h2>Aegis in the terminal.</h2><p>The published package name declared by the CLI workspace is <code>@aegis/cli</code>. Node.js 20 or newer is required by the repository.</p><div className="terminal-card"><header><span>PowerShell</span><CopyCommand value="npm install -g @aegis/cli" /></header><pre><code><b>$</b> npm install -g @aegis/cli{"\n"}<b>$</b> aegis --version{"\n"}<b>$</b> aegis doctor{"\n"}<b>$</b> aegis models{"\n"}<b>$</b> aegis</code></pre></div><p className="honesty-note">Package registry availability is not inferred from the source tree. If npm reports that the package is unavailable, use the repository build documented in the CLI guide.</p></div><div className="cli-orbit" aria-hidden="true"><TerminalSquare size={62} /><span /><i /></div></div></section>

    <section className="download-section local-ai-section"><div className="shell"><div className="public-section-heading"><span className="eyebrow"><Laptop size={15} /> Local intelligence</span><h2>Use Aegis locally.</h2><p>Aegis detects configured runtimes; it does not turn cloud providers into local services.</p></div><div className="runtime-paths"><article><b>01</b><h3>Ollama</h3><p>Run Ollama on <code>127.0.0.1:11434</code>, pull a compatible model, then refresh Models in Aegis.</p><Link href="/docs/providers/ollama">Set up Ollama <ChevronRight size={15} /></Link></article><article><b>02</b><h3>LM Studio</h3><p>Start LM Studio&apos;s OpenAI-compatible local server on <code>127.0.0.1:1234/v1</code>.</p><Link href="/docs/providers/lm-studio">Set up LM Studio <ChevronRight size={15} /></Link></article><article><b>03</b><h3>OpenAI-compatible</h3><p>Custom endpoints require an explicit URL and remain inside the trust boundary you configure.</p><Link href="/docs/providers/openai-compatible">Configure an endpoint <ChevronRight size={15} /></Link></article></div></div></section>

    <section className="download-section requirements-section"><div className="shell requirements-grid"><div><span className="eyebrow">System requirements</span><h2>Built for modern Windows.</h2><p>Exact model memory requirements depend on the model and quantization. Aegis itself does not reserve a fixed GPU requirement.</p></div><div className="requirement-list">{[[Laptop,"Windows","Windows 10 or 11 · x64"],[MemoryStick,"Memory","8 GB practical baseline; more for local models"],[HardDrive,"Storage","Installer under 5 MB; model files require additional space"],[Cpu,"Acceleration","CPU works; supported GPUs can improve local inference"]].map(([Icon,title,body]) => <div key={String(title)}><Icon size={21} /><span><strong>{title as string}</strong><small>{body as string}</small></span></div>)}</div></div></section>

    <section id="releases" className="download-section release-section"><div className="shell"><div className="public-section-heading"><span className="eyebrow">Release integrity</span><h2>Verify before you run.</h2></div><div className="release-ledger"><div><span>Latest release</span><strong>{release.version}</strong><small>{date(release.releasedAt)} · {release.channel}</small></div><div><span>Code signature</span><strong>Not signed</strong><small>Checksum verification is strongly recommended.</small></div><div><span>Previous releases</span><strong>None published here</strong><small>No release history has been invented.</small></div></div><div className="powershell-verify"><div><ShieldCheck size={25} /><span><strong>Verify the NSIS installer</strong><small>PowerShell compares the downloaded file with the manifest hash.</small></span></div><pre><code>Get-FileHash &quot;.\{recommended.filename}&quot; -Algorithm SHA256</code></pre><CopyCommand value={`Get-FileHash ".\\${recommended.filename}" -Algorithm SHA256`} /></div></div></section>

    <section className="download-faq shell"><div><span className="eyebrow">FAQ</span><h2>Before installing.</h2></div><div>{[
      ["Why does SmartScreen appear?","The current development installers are not code-signed. Verify the checksum and provenance; do not disable Windows security globally."],
      ["Is WebView2 required?","Aegis Desktop is built with Tauri on Windows and uses the system WebView2 runtime. Current Windows installations commonly include it; the troubleshooting guide covers a missing runtime."],
      ["Does Local mode need the Aegis API?","The Desktop architecture includes local providers, but capabilities differ by build. Consult the Local mode guide before relying on offline behavior."],
      ["How do I uninstall?","Use Windows Settings → Apps → Installed apps → Aegis Desktop. Local data removal behavior must be reviewed before deleting application folders manually."],
    ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight size={16} /></summary><p>{answer}</p></details>)}</div></section>
  </main>;
}

"use client";

export type TourStep = {
  selector: string;
  title: string;
  description: string;
  side?: "right" | "left" | "top" | "bottom";
};

export const ONBOARDING_STEPS: TourStep[] = [
  {
    selector: ".v3-new-chat",
    title: "New chat",
    description: "Start a fresh conversation with your current model. You can also press ⌘ N from anywhere in the workspace.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/chat"]',
    title: "Chat",
    description: "Your main workspace. Ask questions, delegate tasks and keep every conversation with your model in one calm surface.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/search"]',
    title: "Search",
    description: "Search across your projects, conversations and connected tools — or use web search with your configured provider.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/projects"]',
    title: "Projects",
    description: "Group related work with durable instructions, model choices and conversations that stay attached to each project.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/workspace/models"]',
    title: "Models",
    description: "Browse every model discovered from your providers, filtered by price, modality and capability.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/providers"]',
    title: "Providers",
    description: "Connect local runtimes (Ollama, LM Studio) and cloud providers (NVIDIA NIM, OpenRouter) to reach the intelligence you need.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/github"]',
    title: "GitHub",
    description: "Connect your GitHub account and let Aegis read repositories, issues and pull requests with explicit permission states.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/drive"]',
    title: "Drive",
    description: "Access the files you choose from Google Drive so your model can ground answers in your real documents.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/gmail"]',
    title: "Gmail",
    description: "Read the messages you grant access to, so Aegis can summarize threads and keep your context up to date.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/calendar"]',
    title: "Calendar",
    description: "Let Aegis see your schedule and plan around the meetings and events that matter.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/settings"]',
    title: "Settings",
    description: "Tune appearance, AI defaults, privacy and integrations to make the workspace feel exactly like yours.",
    side: "right",
  },
  {
    selector: '.v3-sidebar__nav a[href="/account"]',
    title: "Account",
    description: "Manage your profile, security and connected accounts. Your models, your tools, your boundaries.",
    side: "right",
  },
];

export const TOUR_STORAGE_KEY = "aegis.onboarding.v1";
export const TOUR_START_EVENT = "aegis:start-tour";

export function requestTour() {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
}

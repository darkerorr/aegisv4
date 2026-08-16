import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ModelSelectionProvider } from "@/features/chat/model-selection-store";
import { ChatAppearanceProvider } from "@/features/settings/chat-appearance-store";
import { GlobalThemeProvider } from "@/features/settings/global-theme-store";
export default function WorkspaceLayout({children}:{children:React.ReactNode}){return <GlobalThemeProvider><ChatAppearanceProvider><ModelSelectionProvider><WorkspaceShell>{children}</WorkspaceShell></ModelSelectionProvider></ChatAppearanceProvider></GlobalThemeProvider>}

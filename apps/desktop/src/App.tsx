import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SidebarProvider, useSidebar } from "./contexts/SidebarContext";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { SplashScreen } from "./components/SplashScreen";
import { DesktopAppShell } from "./layouts/DesktopAppShell";
import { AegisEmptyState } from "./components/ui/AegisUI";
import { ModelStoreProvider } from "./features/models/modelStore";

const WelcomePage = lazy(() => import("./pages/WelcomePage").then((m) => ({ default: m.WelcomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ChatPage = lazy(() => import("./pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const ProvidersPage = lazy(() => import("./pages/ProvidersPage").then((m) => ({ default: m.ProvidersPage })));
const ModelsPage = lazy(() => import("./pages/ModelsPage").then((m) => ({ default: m.ModelsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const CLISessionsPage = lazy(() => import("./pages/CLISessionsPage").then((m) => ({ default: m.CLISessionsPage })));
const ConnectionPage = lazy(() => import("./pages/ConnectionPage").then((m) => ({ default: m.ConnectionPage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const AgentsPage = lazy(() => import("./pages/AgentsPage").then((m) => ({ default: m.AgentsPage })));
const AccountPage = lazy(() => import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const SecurityPage = lazy(() => import("./pages/SecurityPage").then((m) => ({ default: m.SecurityPage })));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage").then((m) => ({ default: m.ConnectionsPage })));
const DiagnosticsPage = lazy(() => import("./pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })));

const AUTH_PAGES = new Set(["Welcome", "Login", "Register", "ForgotPassword", "ResetPassword", "Onboarding"]);

function AppContent() {
  const { status, connectionError, apiAvailable } = useAuth();
  const { view, navigate } = useSidebar();
  const { fetchConversations } = useChat();

  useEffect(() => { if (status === "authenticated") void fetchConversations(); }, [status, fetchConversations]);
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" && apiAvailable && !AUTH_PAGES.has(view)) navigate("Login");
    if ((status === "authenticated" || status === "local") && AUTH_PAGES.has(view)) navigate("Chat");
  }, [apiAvailable, navigate, status, view]);

  if (status === "loading") return <SplashScreen />;
  if (connectionError && status === "unauthenticated") return <Suspense fallback={<SplashScreen />}><ConnectionPage /></Suspense>;
  if (AUTH_PAGES.has(view)) return <div className="app-fullscreen"><Suspense fallback={<SplashScreen />}><AnimatePresence mode="wait">{view === "Welcome" && <WelcomePage key="welcome" />}{view === "Login" && <LoginPage key="login" />}{view === "Register" && <RegisterPage key="register" />}{view === "ForgotPassword" && <ForgotPasswordPage key="forgot" />}{view === "ResetPassword" && <ResetPasswordPage key="reset" />}{view === "Onboarding" && <OnboardingPage key="onboarding" />}</AnimatePresence></Suspense></div>;

  return <Suspense fallback={<SplashScreen />}><DesktopAppShell>
    {view === "Home" && <Dashboard />}
    {(view === "Chat" || view === "NewChat" || view === "Chats") && <ChatPage />}
    {view === "Providers" && <ProvidersPage />}
    {view === "Connections" && <ConnectionsPage />}
    {view === "Models" && <ModelsPage />}
    {view === "Projects" && <ProjectsPage />}
    {view === "Agents" && <AgentsPage />}
    {view === "Settings" && <SettingsPage />}
    {view === "Account" && <AccountPage />}
    {view === "Security" && <SecurityPage />}
    {view === "Diagnostics" && <DiagnosticsPage />}
    {view === "CLISessions" && <CLISessionsPage />}
    {(view === "Help" || view === "Downloads") && <AegisEmptyState title={view} description="This optional module is not installed in the current build." />}
  </DesktopAppShell></Suspense>;
}

export function App() {
  return <SettingsProvider><AuthProvider><SidebarProvider><ModelStoreProvider><ChatProvider><AppContent /></ChatProvider></ModelStoreProvider></SidebarProvider></AuthProvider></SettingsProvider>;
}

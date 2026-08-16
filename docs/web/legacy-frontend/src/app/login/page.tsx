import { AuthForm } from "../../components/AuthForm";
import { SiteNav } from "../../components/SiteNav";
export default function LoginPage() {
  return <main className="min-h-screen bg-[var(--aegis-background)]"><SiteNav /><AuthForm mode="login" /></main>;
}

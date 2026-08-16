import { AuthForm } from "../../components/AuthForm";
import { SiteNav } from "../../components/SiteNav";
export default function RegisterPage() {
  return <main className="min-h-screen bg-[var(--aegis-background)]"><SiteNav /><div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5 py-12"><AuthForm mode="register" /></div></main>;
}

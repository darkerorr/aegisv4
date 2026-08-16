import { useEffect, useState } from "react";
import { LogOut, MonitorSmartphone, RefreshCw, Shield } from "lucide-react";
import { api, describeApiError } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { AegisBadge, AegisButton, AegisCard, AegisEmptyState, AegisLoader } from "../components/ui/AegisUI";

type Session = { id: string; current: boolean; deviceName: string; createdAt: string; lastSeenAt: string; expiresAt: string };
export function SecurityPage() {
  const { status, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(status === "authenticated");
  const [error, setError] = useState("");
  async function load() { if (status !== "authenticated") return; setLoading(true); setError(""); try { setSessions((await api.listSessions()).sessions as Session[]); } catch (err) { setError(describeApiError(err)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [status]);
  if (status === "local") return <section className="feature-page"><header className="feature-heading"><div><p className="eyebrow">Security</p><h1>Sessions</h1></div></header><AegisEmptyState icon={<Shield size={24} />} title="Local mode has no cloud session" description="Your current local workspace does not require an Aegis account." /></section>;
  return <section className="feature-page"><header className="feature-heading"><div><p className="eyebrow">Account protection</p><h1>Security</h1><p>Review devices that can access your synchronized workspace.</p></div><AegisButton onClick={() => void load()}><RefreshCw size={15} /> Refresh</AegisButton></header>{loading ? <AegisLoader label="Loading sessions" /> : error ? <p className="form-message error">{error}</p> : <div className="session-list">{sessions.map((session) => <AegisCard key={session.id} className="session-row"><span className="card-icon"><MonitorSmartphone size={18} /></span><div><h2>{session.deviceName || "Aegis device"}</h2><p>Last active {new Date(session.lastSeenAt).toLocaleString()}</p></div>{session.current ? <AegisBadge tone="success">Current device</AegisBadge> : <AegisButton variant="danger" onClick={async () => { await api.revokeSession(session.id); await load(); }}>Revoke</AegisButton>}</AegisCard>)}</div>}<AegisButton variant="danger" onClick={() => void logout()}><LogOut size={15} /> Sign out on this device</AegisButton></section>;
}

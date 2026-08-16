import { Scale } from "lucide-react";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { getLegalConfig } from "@/lib/legal/config";

export const metadata = { title: "Legal notice" };
export default function LegalPage() {
  const legal = getLegalConfig();
  const fields = [["Publisher", legal.identity.entityName], ["Legal form", legal.identity.entityForm], ["Registered address", legal.identity.address], ["Contact", legal.identity.email], ["Registration", legal.identity.registration], ["VAT", legal.identity.vat], ["Publication director", legal.identity.publisher], ["Host", legal.identity.hostName], ["Host address", legal.identity.hostAddress]];
  return <LegalPageShell eyebrow="Legal notice" title="Operator information." intro="Required publisher and hosting fields are configuration-driven. Missing values are never replaced with a fictional company." icon={Scale} configured={legal.configured}><section><h2>Publisher and host</h2><div className="legal-fields">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "Not configured"}</strong></div>)}</div></section><section><h2>Intellectual property</h2><p>Aegis names, interface assets, code and documentation can be protected by their respective licenses and rights. The repository license and third-party asset licenses govern the materials they cover; no broader ownership claim is made here.</p></section><section><h2>Reporting</h2><p>{legal.identity.email ? <>Contact <a href={`mailto:${legal.identity.email}`}>{legal.identity.email}</a> for publisher matters.</> : "A legal contact address has not been configured."} Security reports should follow the Security page.</p></section></LegalPageShell>;
}

import { AegisLogo } from "@/components/brand/aegis-logo";
import { ProviderIcon } from "@/components/brand/provider-icon";
const providers=["nvidia","openrouter","ollama","lmstudio","openai","anthropic","gemini","mistral","deepseek","qwen","llama","github"];
export function ModelOrbit(){return <div className="model-orbit" aria-label="Supported intelligence providers"><div className="orbit-core"><AegisLogo size={72}/><span>Aegis</span></div>{providers.map((p,i)=><div key={p} className="orbit-node" style={{"--i":i} as React.CSSProperties}><ProviderIcon provider={p} size={24} variant="monochrome"/><small>{p}</small></div>)}</div>}

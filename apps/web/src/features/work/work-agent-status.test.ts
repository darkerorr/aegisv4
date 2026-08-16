import { describe, expect, it } from "vitest";
import {
  classifyProviderLayer,
  connectionPhase,
  deriveWorkStatus,
  type AgentLayerInput,
  type ProviderLayerInput,
} from "./work-agent-status";

const agent = (overrides: Partial<AgentLayerInput> = {}): AgentLayerInput => ({
  process: "online",
  connection: "connected",
  authentication: "authenticated",
  ...overrides,
});

const providers = (overrides: Partial<ProviderLayerInput> = {}): ProviderLayerInput => ({
  status: "not_configured",
  configured: 0,
  enabled: 0,
  ready: false,
  count: 0,
  ...overrides,
});

describe("work agent status layers", () => {
  it("process online + token absent -> Agent ONLINE, Auth REQUIRED", () => {
    const status = deriveWorkStatus(agent({ connection: "auth_required", authentication: "required" }), providers());
    expect(status.process).toBe("online");
    expect(status.authentication).toBe("required");
    expect(status.connection).toBe("auth_required");
    expect(status.authMessage).toContain("not authenticated");
  });

  it("process online + valid token -> Agent ONLINE, Connected", () => {
    const status = deriveWorkStatus(agent(), providers());
    expect(status.process).toBe("online");
    expect(status.connection).toBe("connected");
    expect(status.authentication).toBe("authenticated");
    expect(status.connectionMessage).toContain("connected");
  });

  it("process offline -> Agent OFFLINE", () => {
    const status = deriveWorkStatus(agent({ process: "offline", connection: "unreachable" }), providers());
    expect(status.process).toBe("offline");
    expect(status.connection).toBe("unreachable");
    expect(status.agentMessage).toContain("not running");
  });

  it("agent online + no provider -> Agent ONLINE, Provider NOT_CONFIGURED", () => {
    const status = deriveWorkStatus(agent(), providers({ status: "not_configured" }));
    expect(status.process).toBe("online");
    expect(status.provider).toBe("not_configured");
    expect(status.providerMessage).toContain("no AI provider is configured");
  });

  it("agent online + invalid provider -> Agent ONLINE, Provider INVALID", () => {
    const status = deriveWorkStatus(
      agent(),
      providers({ status: "invalid", configured: 1, enabled: 0, ready: false, count: 1 }),
    );
    expect(status.process).toBe("online");
    expect(status.provider).toBe("invalid");
  });

  it("agent online + available provider -> Agent ONLINE, Provider READY", () => {
    const status = deriveWorkStatus(
      agent(),
      providers({ status: "ready", configured: 1, enabled: 1, ready: true, count: 1 }),
    );
    expect(status.process).toBe("online");
    expect(status.provider).toBe("ready");
    expect(status.providerCount).toBe(1);
  });

  it("missing token never downgrades the agent below ONLINE", () => {
    const status = deriveWorkStatus(agent({ connection: "auth_required", authentication: "required" }), providers());
    expect(status.process).toBe("online");
    expect(status.canRunTask).toBe(false);
  });

  it("no provider never causes 'Local Agent offline'", () => {
    const status = deriveWorkStatus(agent(), providers());
    expect(status.process).toBe("online");
    expect(status.agentMessage).toContain("running");
    expect(status.agentMessage).not.toContain("offline");
  });

  it("a missing provider keeps the agent process online regardless of connection", () => {
    for (const connection of ["connected", "auth_required"] as const) {
      const status = deriveWorkStatus(agent({ connection, authentication: connection === "connected" ? "authenticated" : "required" }), providers());
      expect(status.process).toBe("online");
      expect(status.provider).toBe("not_configured");
    }
  });
});

describe("classifyProviderLayer", () => {
  it("returns ready when a provider is configured and enabled", () => {
    expect(classifyProviderLayer(2, 1, true)).toBe("ready");
  });
  it("returns invalid when configured or enabled but not ready", () => {
    expect(classifyProviderLayer(1, 0, false)).toBe("invalid");
    expect(classifyProviderLayer(0, 1, false)).toBe("invalid");
  });
  it("returns not_configured when nothing is present", () => {
    expect(classifyProviderLayer(0, 0, false)).toBe("not_configured");
  });
});

describe("connectionPhase", () => {
  it("loss of connection after being online -> reconnecting", () => {
    expect(connectionPhase("online", "offline", true)).toBe("reconnecting");
    expect(connectionPhase("reconnecting", "offline", true)).toBe("reconnecting");
  });
  it("restored connection -> online", () => {
    expect(connectionPhase("reconnecting", "online", false)).toBe("online");
  });
  it("first poll while starting -> connecting", () => {
    expect(connectionPhase(null, "offline", true)).toBe("connecting");
  });
  it("never settles permanently offline while a poll is in flight", () => {
    expect(connectionPhase("online", "offline", true)).not.toBe("offline");
    expect(connectionPhase(null, "offline", false)).toBe("offline");
  });
});
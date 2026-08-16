import { describe, expect, it } from "vitest";
import { classifyIntent, deriveSearchQuery } from "./index.js";

describe("intent classifier", () => {
  it("keeps ordinary chat on the provider fast path", () => expect(classifyIntent({ text: "Explain JavaScript closures" })).toMatchObject({ kind: "general_chat", tools: [] }));
  it("routes a latest-email request to Gmail", () => expect(classifyIntent({ text: "Quel est mon dernier mail ?" })).toMatchObject({ kind: "gmail", tools: ["gmail.getLatestMessage"] }));
  it("selects attachment reading when a file is present", () => expect(classifyIntent({ text: "Résume ce fichier", attachmentIds: ["file-1"] }).tools).toContain("attachments.readText"));
  it("routes GitHub repository listing without adding unrelated tools", () => expect(classifyIntent({ text: "Liste mes dépôts GitHub." }).tools).toEqual(["github.listRepositories"]));
  it("routes issues and asks for a repository when owner/repo is absent", () => expect(classifyIntent({ text: "Liste les issues ouvertes." })).toMatchObject({ tools: ["github.listIssues"], requiresClarification: true }));
  it("routes README reading with an explicit repository", () => expect(classifyIntent({ text: "Lis le README du repo openai/openai-node sur GitHub." })).toMatchObject({ tools: ["github.getFileContent"], requiresClarification: false }));
  it("routes code search with an explicit repository", () => expect(classifyIntent({ text: "Cherche submitMessage dans le code du repo aegis/aegis." })).toMatchObject({ tools: ["github.searchCode"], requiresClarification: false }));
  it("routes pull request listing", () => expect(classifyIntent({ text: "Liste les pull requests de owner/repo." }).tools).toEqual(["github.listPullRequests"]));
});

describe("deriveSearchQuery", () => {
  it("strips narrative framing and keeps the question core (French)", () =>
    expect(deriveSearchQuery("ma grand-mère me demande comment faire des pâtes")).toBe("comment faire des pâtes"));
  it("handles typo-ridden framing without accents", () =>
    expect(deriveSearchQuery("ma grands mere me demande comment faire des pates")).toBe("comment faire des pates"));
  it("strips narrative framing (English)", () =>
    expect(deriveSearchQuery("my grandma asks me how to make pasta")).toBe("how to make pasta"));
  it("strips direct command prefixes", () =>
    expect(deriveSearchQuery("dis-moi comment faire des pâtes")).toBe("comment faire des pâtes"));
  it("strips 'je veux savoir' style lead-ins", () =>
    expect(deriveSearchQuery("je voudrais savoir quand sortira le prochain iPhone")).toBe("quand sortira le prochain iPhone"));
  it("strips politeness at both ends", () =>
    expect(deriveSearchQuery("cherche la météo à Paris, s'il te plaît merci")).toBe("la météo à Paris"));
  it("removes 'sur le web' qualifiers", () =>
    expect(deriveSearchQuery("trouve les derniers résultats de la Ligue 1 sur le web")).toBe("les derniers résultats de la Ligue 1"));
  it("keeps a plain question untouched", () =>
    expect(deriveSearchQuery("Pourquoi le ciel est-il bleu ?")).toBe("Pourquoi le ciel est-il bleu"));
  it("keeps a bare topic untouched", () =>
    expect(deriveSearchQuery("meilleures pâtes italiennes")).toBe("meilleures pâtes italiennes"));
  it("does not return an empty query", () =>
    expect(deriveSearchQuery("recherche s'il te plaît")).toBe("recherche"));
});
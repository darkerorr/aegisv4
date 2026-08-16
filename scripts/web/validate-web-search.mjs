import { DuckDuckGoProvider } from "../../packages/tools/dist/index.js";
const provider = new DuckDuckGoProvider();
const results = await provider.search({ query: "latest stable Node.js version", maxResults: 5, freshness: "month", language: "en", country: "us" });
console.log(`REAL_WEB_SEARCH_RESULTS=${results.length}`);
for (const result of results) console.log(`${result.rank}. ${result.title} | ${result.url}`);
if (results.length === 0) process.exitCode = 1;
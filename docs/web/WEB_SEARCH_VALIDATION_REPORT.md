# Web Search validation report

## Real network validation

The query used was the requested current-information scenario: `latest stable Node.js version`. DuckDuckGo returned five real results; no API key was configured.

Validated sources:

1. `https://nodejs.org/en/download/current`
2. `https://versionlog.com/nodejs/`
3. `https://nodejs.org/en`
4. `https://www.upgrad.com/blog/node-js-versions/`
5. `https://www.nodechangelog.com/`

The validation asserted non-empty titles, HTTP(S) URLs, unique URLs and ranked results. It did not infer a version number from snippets, so it does not manufacture an answer beyond the retrieved sources.

## Automated coverage

- Tools/Web Search unit tests: 20 passed.
- Agent intent tests: 8 passed.
- API route/auth/rate implementation: TypeScript and API suite passed.
- SSRF private-address and redirect cases: passed.
- No-result behavior: passed.
- Source rendering policy: successful tool context is required before the model may claim a search.

## Limitations

A full provider-generated chat answer using a paid/remote model was not executed during this validation. The real DuckDuckGo query and source retrieval succeeded; SSE/tool orchestration is covered by code audit and API/Playwright tests. Provider-specific answer quality remains dependent on an available configured model.
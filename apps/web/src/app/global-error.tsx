"use client";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="route-error">
          <p>500 / AEGIS</p>
          <h1>The workspace hit an unexpected error.</h1>
          <span>Nothing was sent anywhere — your data stays local to this machine.</span>
          {error.digest && <code>{error.digest}</code>}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="button button--primary" type="button" onClick={() => reset()}>Try again</button>
            <Link className="button" href="/chat">Return to workspace</Link>
          </div>
        </main>
      </body>
    </html>
  );
}

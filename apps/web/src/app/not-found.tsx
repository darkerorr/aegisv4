import Link from "next/link";

export default function NotFound() {
  return <main className="route-error"><p>404 / AEGIS</p><h1>This route is outside the network.</h1><span>The page may have moved or never existed.</span><Link className="button button--primary" href="/">Return home</Link></main>;
}

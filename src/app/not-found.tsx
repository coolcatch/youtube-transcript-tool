import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-card">
      <h1>Page not found</h1>
      <p>
        <Link href="/">Back to the transcript generator</Link>
      </p>
    </div>
  );
}

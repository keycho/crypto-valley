import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1>Crypto Valley</h1>
      <p>
        A cozy MMO where players excavate the ruins of a lost blockchain
        civilization, build a town that remembers them, and discover relics that
        become part of the world&apos;s permanent history.
      </p>
      <p>
        <Link href="/play">Enter the valley →</Link>
      </p>
    </main>
  );
}

"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
};

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the whole
 * document, so it uses inline styles rather than relying on the app stylesheet.
 */
export default function GlobalError({ error, reset, unstable_retry }: GlobalErrorProps) {
  function retry() {
    if (unstable_retry) unstable_retry();
    else if (reset) reset();
    else window.location.reload();
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          textAlign: "center",
          background: "#F8F8F5",
          color: "#172D2A",
          fontFamily: "Manrope, Inter, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480 }}>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A6A2F" }}>
            NeighbourLink
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0" }}>Something went wrong</h1>
          <p style={{ color: "#5B6B60", lineHeight: 1.6 }}>Please try again in a moment.</p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5B6B60" }}>Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 20,
              background: "#172D2A",
              color: "#F8F8F5",
              border: 0,
              borderRadius: 9999,
              padding: "12px 22px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

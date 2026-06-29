import { useState } from "react";
import { SurfClient } from "@surf_liquid/core-sdk";
import { SurfWidget } from "@surf_liquid/surf-widget";
import "@surf_liquid/surf-widget/dist/index.css";

const APP_ID = import.meta.env.VITE_APP_ID; //Your APPID

const CHAINS = [
  { chainId: 1, label: "Ethereum" },
  { chainId: 8453, label: "Base" },
  { chainId: 137, label: "Polygon" },
];

type ClientMap = Record<number, ReturnType<typeof SurfClient.create>>;

export function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setLoading(true);
    setError("");
    try {
      const newClients: ClientMap = {};

      // Step 1 — connect + authenticate once (single SIWE signature)
      const [first, ...rest] = CHAINS;
      const firstClient = SurfClient.create({
        projectName: "surf-demo",
        appId: APP_ID,
        chainId: first.chainId,
      });
      await (firstClient as any).verifyApp?.(); // §2 — validate appId (v0.4.0+)
      const state = await firstClient.connectWallet("metamask");
      const auth = await firstClient.authenticate();
      if (!auth.authenticated) throw new Error("Authentication failed"); // §1
      newClients[first.chainId] = firstClient;

      // Step 2 — wire up remaining chains; MetaMask is already connected so
      // connectWallet returns immediately. Session cookie covers auth for all chains.
      for (const { chainId } of rest) {
        const client = SurfClient.create({
          projectName: "surf-demo",
          appId: APP_ID,
          chainId,
        });
        await client.connectWallet("metamask");
        newClients[chainId] = client;
      }

      setClients(newClients);
      setAddress(state.address);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!address || Object.keys(clients).length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#f0f4ff",
          fontFamily: "Inter, system-ui, sans-serif",
          gap: 12,
        }}
      >
        <button
          onClick={connect}
          disabled={loading}
          style={{
            padding: "12px 36px",
            borderRadius: 50,
            border: "none",
            background: loading ? "#93c5fd" : "#3b82f6",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && (
          <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f0f4ff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {CHAINS.map(({ chainId }) => (
        <SurfWidget
          key={chainId}
          appId={APP_ID}
          client={clients[chainId]}
          walletAddress={address}
          chainId={chainId}
        />
      ))}
    </div>
  );
}

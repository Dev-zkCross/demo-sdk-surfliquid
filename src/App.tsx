import React, { useState } from 'react';
import { SurfClient } from '@surf_liquid/core-sdk';
import { SurfWidget } from '@surf_liquid/surf-widget';
import '../../src/styles/widget.css';

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_ID = import.meta.env.VITE_APP_ID;
const CHAIN_ID = 8453; // 8453 = Base, 137 = Polygon

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [address, setAddress]   = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [surfClient, setSurfClient] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function connect() {
    setLoading(true);
    setError('');
    try {
      const client = SurfClient.create({ projectName: 'surf-demo', appId: APP_ID, chainId: 8453 });
      const state  = await client.connectWallet('metamask');
      await client.authenticate();
      setSurfClient(client);
      setAddress(state.address);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!address || !surfClient) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        background: '#f0f4ff', fontFamily: 'Inter, system-ui, sans-serif', gap: 12,
      }}>
        <button
          onClick={connect}
          disabled={loading}
          style={{
            padding: '12px 36px', borderRadius: 50, border: 'none',
            background: loading ? '#93c5fd' : '#3b82f6',
            color: 'white', fontSize: 15, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Connecting…' : 'Connect Wallet'}
        </button>
        {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#f0f4ff',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <SurfWidget
        client={surfClient}
        walletAddress={address}
        chainId={CHAIN_ID}
      />
    </div>
  );
}

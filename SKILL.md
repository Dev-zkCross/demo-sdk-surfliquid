---
name: surf-widget-integration
description: Integrate the @surf_liquid/surf-widget React component into a web app — drop in the SurfWidget, configure theming, wire deposit/withdraw modals, read vault state via hooks, and handle agent activity. Use this skill whenever a task involves @surf_liquid/surf-widget: SurfWidget props, SurfProvider setup, SurfTheme customization, DepositModal/WithdrawModal/VaultCard sub-components, hooks (useDeposit, useWithdraw, useVault, useAgentMessages), or debugging the widget's interaction with @surf_liquid/core-sdk.
---

# SurfLiquid Widget Integration Skill

## What this is

`@surf_liquid/surf-widget` is a **React 18** drop-in DeFi yield widget for integrating SurfLiquid vaults into any web app. It wraps the full deposit/withdraw/portfolio UI into a single `<SurfWidget>` component. It is built on top of `@surf_liquid/core-sdk` (the low-level client SDK) — the widget consumes a pre-built `SurfClient` instance and handles all the UI state itself.

**Key distinction:** `@surf_liquid/surf-widget` is the *UI layer*; `@surf_liquid/core-sdk` is the *transport/chain layer*. You construct and authenticate a `SurfClient` yourself, then hand it to the widget. The widget never constructs its own client.

Package entry points: `main` → `dist/index.js`, `module` → `dist/index.esm.js`, `types` → `dist/index.d.ts`. CSS must be imported separately.

```bash
npm install @surf_liquid/surf-widget @surf_liquid/core-sdk ethers
# also: react react-dom (peer deps, >=18)
```

## Table of contents

- [What this is](#what-this-is)
- [When to use this skill](#when-to-use-this-skill)
- [Prerequisites — what must happen before rendering](#prerequisites--what-must-happen-before-rendering)
- [Installation](#installation)
- [Minimal integration (the demo pattern)](#minimal-integration-the-demo-pattern)
- [SurfWidget props](#surfwidget-props)
- [SurfTheme — visual customization](#surftheme--visual-customization)
- [SurfProvider — advanced / headless use](#surfprovider--advanced--headless-use)
- [Sub-components](#sub-components)
- [Hooks](#hooks)
- [Types reference](#types-reference)
- [CSS import](#css-import)
- [Gotchas & footguns](#gotchas--footguns)
- [Integration checklist](#integration-checklist)

## When to use this skill

Reach for this skill when a task involves any of the following:

- Adding `<SurfWidget>` to a React app, passing `client`, `walletAddress`, and `chainId`.
- Theming the widget via `SurfTheme` (colors, border-radius, font family).
- Using `SurfProvider` + `useSurf()` to build a custom layout that still piggybacks on widget context.
- Rendering sub-components standalone: `DepositModal`, `WithdrawModal`, `VaultCard`, `VaultActivityModal`, `ManageDropdown`.
- Using hooks: `useDeposit`, `useWithdraw`, `useVault`, `useAgentMessages`, `useDepositBalance`, `useWithdrawableBalance`.
- Debugging why the widget renders but deposit/withdraw fails (usually a missing auth step or wrong `chainId`).
- Importing types: `VaultInfo`, `SurfWidgetProps`, `SurfTheme`, `DepositStep`, `WithdrawStep`, etc.

## Prerequisites — what must happen before rendering

**The widget does not connect or authenticate a wallet.** You must do all of the following *before* passing `client` to `<SurfWidget>`:

1. `SurfClient.create(config)` — construct the client (sync, no network).
2. `client.connectWallet('metamask')` — connect a browser wallet; get back `{ address, chainId }`.
3. `client.authenticate()` — run the SIWE nonce/sign/login handshake to set the httpOnly session cookie.

Only then render `<SurfWidget client={client} walletAddress={address} chainId={chainId} />`.

If you render the widget before authentication, REST-backed calls inside the widget (vault deploy, agent messages) will get 401s. The widget will not re-authenticate itself.

## Installation

```bash
npm install @surf_liquid/surf-widget @surf_liquid/core-sdk ethers
```

Peer dependencies: `react >=18`, `react-dom >=18`. The widget does not list `@surf_liquid/core-sdk` as a peer dep (it uses its own `ISurfClient` interface), but you need `core-sdk` to build the client. Ethers v6 is required by `core-sdk`.

**Always import the CSS** — the widget ships pre-built Tailwind styles that won't apply without it:

```ts
import '@surf_liquid/surf-widget/dist/index.css';
```

## Minimal integration (the demo pattern)

This is the exact pattern in the demo app ([src/App.tsx](src/App.tsx)):

```tsx
import { useState } from 'react';
import { SurfClient } from '@surf_liquid/core-sdk';
import { SurfWidget } from '@surf_liquid/surf-widget';
import '@surf_liquid/surf-widget/dist/index.css';

const APP_ID = import.meta.env.VITE_APP_ID;
const CHAIN_ID = 8453; // Base

export function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [surfClient, setSurfClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    setLoading(true);
    setError('');
    try {
      const client = SurfClient.create({ projectName: 'surf-demo', appId: APP_ID, chainId: CHAIN_ID });
      const state = await client.connectWallet('metamask');
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
    return <button onClick={connect}>{loading ? 'Connecting…' : 'Connect Wallet'}</button>;
  }

  return (
    <SurfWidget
      client={surfClient}
      walletAddress={address}
      chainId={CHAIN_ID}
    />
  );
}
```

## SurfWidget props

`SurfWidget` is the single drop-in component. All other exported components are either used internally or available for headless/custom layouts.

```ts
interface SurfWidgetProps {
  client: ISurfClient;       // required — a connected + authenticated SurfClient
  walletAddress: string;     // required — the connected wallet's EOA address
  chainId?: number;          // optional — 8453 (Base, default), 137 (Polygon), 84532 (Base Sepolia)
  theme?: SurfTheme;         // optional — visual customization (see below)
  className?: string;        // optional — extra CSS class on the widget root element
  minDeposit?: number;       // optional — minimum deposit amount, defaults to 0.1
  onSuccess?: (action: 'deposit' | 'withdraw', txHash: string) => void;
  onError?: (action: 'deposit' | 'withdraw', error: Error) => void;
}
```

**`client`** — must implement `ISurfClient`. A `SurfClient` instance from `@surf_liquid/core-sdk` satisfies this. The interface the widget uses:

```ts
interface ISurfClient {
  getVault(walletAddress?: string): Promise<SurfVaultInfo>;
  deployVault(): Promise<{ vaultAddress: string; transactionHash: string; salt: string }>;
  deposit(params: { asset: string; amount: string }): Promise<{ hash: string; wait(): Promise<unknown> }>;
  withdraw(params: { asset: string; amount?: string }): Promise<{ hash: string; wait(): Promise<unknown> }>;
  getSupportedAssets(chainId?: number): Promise<SurfSupportedAsset[]>;
  getTokenBalance(tokenAddress: string, owner?: string): Promise<bigint>;
  getWithdrawableAmount(assetAddress: string, vaultAddress?: string): Promise<bigint>;
  getAgentMessages(walletAddress?: string, page?: number, limit?: number, from?: string, to?: string): Promise<AgentMessagesResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (data: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, handler: (data: any) => void): void;
}
```

**`chainId`** — controls which chain's assets and vault the widget shows. Defaults to `8453` (Base). Pass `137` for Polygon, `84532` for Base Sepolia. Must match the chain you passed to `SurfClient.create(...)`.

**`onSuccess` / `onError`** — callbacks fired after a deposit or withdraw completes or errors. These fire after the transaction receipt is confirmed (for success) or after the error is thrown. Use these to update parent UI state (e.g. show a toast, refresh a balance display).

## SurfTheme — visual customization

Pass a `theme` prop to `<SurfWidget>` (or to `<SurfProvider config={...}>`) to override the widget's default look:

```ts
interface SurfTheme {
  colors?: {
    primary?: string;        // main action color (buttons, highlights)
    primaryText?: string;    // text on primary-colored backgrounds
    background?: string;     // widget outer background
    cardBackground?: string; // inner card/panel background
    text?: string;           // primary text color
    textSecondary?: string;  // muted/secondary text
    apy?: string;            // APY percentage color
    border?: string;         // border/divider color
    success?: string;        // success state color
  };
  borderRadius?: string;     // e.g. "12px" or "0.75rem"
  fontFamily?: string;       // e.g. "'Inter', system-ui, sans-serif"
}
```

Example — dark mode theme:

```tsx
<SurfWidget
  client={client}
  walletAddress={address}
  chainId={8453}
  theme={{
    colors: {
      primary: '#6366f1',
      primaryText: '#ffffff',
      background: '#0f172a',
      cardBackground: '#1e293b',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      apy: '#22c55e',
      border: '#334155',
      success: '#22c55e',
    },
    borderRadius: '16px',
    fontFamily: "'Inter', sans-serif",
  }}
/>
```

## SurfProvider — advanced / headless use

For custom layouts where you want to use hooks directly instead of the all-in-one `<SurfWidget>`, use `SurfProvider` to inject context and build your own UI on top.

```tsx
import { SurfProvider, useSurf, useVault, useDeposit } from '@surf_liquid/surf-widget';
import { useRef } from 'react';

function CustomVaultUI() {
  const { surfClient, walletAddress, theme } = useSurf();
  const { vault, isLoading } = useVault();
  const { step, execute } = useDeposit();
  // ...
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  const config = {
    client: surfClient,      // authenticated SurfClient
    walletAddress: address,
    chainId: 8453,
    theme: { colors: { primary: '#6366f1' } },
    minDeposit: 0.1,         // optional, defaults to 0.1
    onSuccess: (action, txHash) => console.log(action, txHash),
  };

  return (
    <div ref={containerRef}>
      <SurfProvider config={config} containerRef={containerRef}>
        <CustomVaultUI />
      </SurfProvider>
    </div>
  );
}
```

`SurfProvider` requires a `containerRef` pointing to a mounted DOM element. This ref is used by modals for portal rendering and click-outside detection.

`useSurf()` — read the provider value anywhere in the tree:

```ts
interface SurfContextValue {
  walletAddress: string;
  chainId: number;
  surfClient: ISurfClient;
  theme: SurfTheme;
  minDeposit: number;        // resolved minimum deposit (defaults to 0.1)
  onSuccess?: (action: 'deposit' | 'withdraw', txHash: string) => void;
  onError?: (action: 'deposit' | 'withdraw', error: Error) => void;
}
```

## Sub-components

All sub-components must be rendered **inside** a `SurfProvider` tree (they call `useSurf()` internally). `SurfWidget` sets up `SurfProvider` for you.

### `VaultCard`

Displays a single vault's balance, APY, and action buttons.

```tsx
<VaultCard
  vault={vault}              // VaultInfo (from useVault())
  onDeposit={() => {}}
  onWithdraw={() => {}}
  onViewDeposits={() => {}}
  onViewActivities={() => {}}
  isSelected={false}         // optional
  isLoading={false}          // optional
  className=""               // optional
/>
```

### `DepositModal`

```tsx
<DepositModal
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  vault={vault}                         // VaultInfo | null
  onSwitchToWithdraw={() => {}}         // optional
/>
```

### `WithdrawModal`

```tsx
<WithdrawModal
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  vault={vault}                         // VaultInfo | null
  onSwitchToDeposit={() => {}}          // optional
/>
```

### `VaultActivityModal`

Shows deposit history and agent activity in tabs.

```tsx
<VaultActivityModal
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  initialTab="activities"               // "activities" | "deposits"
  vault={vault}                         // VaultInfo | null
  onWithdraw={() => {}}                 // optional
  onDeposit={() => {}}                  // optional
/>
```

### `ManageDropdown`

Action menu (withdraw / view deposits / view activities).

```tsx
<ManageDropdown
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  onWithdraw={() => {}}
  onViewDeposits={() => {}}
  onViewActivities={() => {}}
/>
```

### `Modal` (generic)

A low-level portal modal wrapper. Rarely needed directly.

```tsx
<Modal isOpen={isOpen} onClose={onClose} className="optional-extra-class">
  {/* content */}
</Modal>
```

### `Button`

Styled button with variants, sizes, loading state, and icon slots.

```tsx
<Button
  variant="primary"          // "primary" | "outline" | "ghost" | "soft"
  size="md"                  // "sm" | "md" | "lg"
  isLoading={false}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  fullWidth={false}
  disabled={false}
>
  Deposit
</Button>
```

### `Tabs`

```tsx
<Tabs
  tabs={[{ id: 'deposit', label: 'Deposit' }, { id: 'withdraw', label: 'Withdraw' }]}
  activeTab="deposit"
  onChange={(id) => setTab(id)}
  variant="pill"             // "pill" | "underline"
/>
```

### `StepProgress`

Renders a step-by-step progress indicator for transactions.

```tsx
<StepProgress
  steps={[
    { id: 'approve', title: 'Approve', description: 'Allow spend', status: 'completed', txHash: '0x…' },
    { id: 'deposit', title: 'Deposit', description: 'Send tokens', status: 'active' },
  ]}
  baseExplorerUrl="https://basescan.org"  // optional
/>
```

`StepStatus = 'pending' | 'active' | 'completed' | 'error'`

### `TokenIcon`

```tsx
<TokenIcon symbol="USDC" icon="/usdc.png" size={24} className="" />
```

### `RegistrationForm`

Renders a form to register a new app with SurfLiquid (returns `appId` + `apiSecret`). Mainly useful in developer onboarding UIs.

```tsx
<RegistrationForm
  walletAddress={address}     // optional pre-fill
  onSuccess={(creds) => {     // { appId: string; apiSecret: string }
    console.log(creds.appId);
  }}
/>
```

## Hooks

All hooks require a `SurfProvider` ancestor in the React tree. `SurfWidget` provides this automatically. For custom layouts, wrap with `SurfProvider` first.

### `useSurf(): SurfContextValue`

Returns the full provider context: `{ walletAddress, chainId, surfClient, theme, onSuccess, onError }`. Use this to access the client or wallet address from any nested component without prop drilling.

### `useVault(): UseVaultReturn`

Fetches and caches the current user's vault state from `client.getVault()`.

```ts
interface UseVaultReturn {
  vault: VaultInfo | null;  // null while loading or if no vault exists
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;      // force a fresh fetch
}
```

`VaultInfo` is the widget's normalized vault shape (distinct from the raw `SurfVaultInfo` returned by the client):

```ts
interface VaultInfo {
  token: TokenInfo;          // { symbol, name, icon?, decimals, address }
  chain: ChainInfo;          // { name, id }
  balance: string;           // formatted string, e.g. "1,234.56"
  earnings: string;          // formatted earnings string
  apy: number;               // e.g. 8.5 (percent)
  withdrawalType: 'instant' | 'standard';
  availableBalance: string;  // formatted withdrawable balance
  userVaultAddress?: string; // on-chain vault contract address
  assets?: SurfVaultAsset[]; // raw asset breakdown (used in deposits tab)
}
```

### `useDeposit(): UseDepositReturn`

Manages deposit flow state.

```ts
interface UseDepositReturn {
  step: DepositStep;          // current step (see below)
  isProcessing: boolean;      // true while any step is in flight
  execute: (amount: string, vault: VaultInfo) => Promise<void>;
  reset: () => void;          // return to 'idle'
}
```

`DepositStep` is a discriminated union:

```ts
type DepositStep =
  | { id: 'idle' }
  | { id: 'creating_contract'; txHash?: string }  // deploying vault
  | { id: 'approving';         txHash?: string }  // ERC-20 approval
  | { id: 'depositing';        txHash?: string }  // deposit tx in flight
  | { id: 'success';  txHash: string; amount: string }
  | { id: 'error';    error: Error };
```

Call `execute(amount, vault)` with a human-readable amount string (e.g. `"100"`) and the `VaultInfo` from `useVault()`. The hook calls `client.deposit()` internally, handles vault deployment if needed, and updates `step` through each stage.

### `useWithdraw(): UseWithdrawReturn`

Manages withdraw flow state.

```ts
interface UseWithdrawReturn {
  step: WithdrawStep;
  isProcessing: boolean;
  execute: (amount: string, vault: VaultInfo) => Promise<void>;
  reset: () => void;
}
```

`WithdrawStep` is a discriminated union:

```ts
type WithdrawStep =
  | { id: 'idle' }
  | { id: 'closing_position'; txHash?: string }
  | { id: 'success';  txHash: string; amount: string }
  | { id: 'error';    error: Error };
```

Pass `amount = "0"` (or omit `amount` in `execute`) to withdraw everything.

### `useDepositBalance(tokenAddress, decimals?): UseBalanceReturn`

Fetches the wallet's spendable token balance for the deposit form. Calls `client.getTokenBalance(tokenAddress)` which returns a raw `bigint` (ERC20 `balanceOf`), then formats it.

```ts
interface UseBalanceReturn {
  balance: string;    // formatted display string (e.g. "1,234.56")
  isLoading: boolean;
  refetch: () => void;
}
```

**Note:** this is the *wallet* balance, NOT the vault's holdings. For what the vault holds use `useWithdrawableBalance`.

### `useWithdrawableBalance(assetAddress, vaultAddress?, decimals?): UseBalanceReturn`

Fetches the max withdrawable amount from the vault. Calls `client.getWithdrawableAmount(assetAddress, vaultAddress?)` (on-chain vault read). Same return shape as `useDepositBalance`.

### `useAgentMessages(): UseAgentMessagesReturn`

Fetches agent activity messages.

```ts
interface UseAgentMessagesReturn {
  activities: VaultActivity[];
  isLoading: boolean;
  refetch: () => void;
}

interface VaultActivity {
  id: string;
  type: 'deposit' | 'withdraw';
  description: string;
  protocol: string;
  timestamp: number;         // unix ms
  txHash?: string;
}
```

Internally calls `client.getAgentMessages(walletAddress)` (REST), which returns `AgentMessagesResult` (paginated). The hook unwraps `.messages`, maps each `AgentMessage` into a `VaultActivity`, and exposes the flat `activities` array.

## Types reference

### `AgentMessage` full shape

`client.getAgentMessages()` returns `AgentMessagesResult` whose `.messages` array contains:

```ts
interface AgentMessage {
  message: string;
  txHash: string;
  timestamp: string;          // ISO 8601, e.g. "2026-04-09T11:59:13.000Z"
  transactionType:
    | 'INITIAL_DEPOSIT' | 'DEPOSIT' | 'USER_DEPOSIT'
    | 'WITHDRAWAL' | 'USER_WITHDRAWAL'
    | 'REBALANCE' | 'REBALANCE_COMPLETED' | 'REBALANCE_CANCELLED'
    | 'CROSS_CHAIN_REBALANCE' | 'MERKL_CLAIM'
    | 'ASSET_ADDED' | 'ASSET_REMOVED' | 'ASSET_SWAPPED'
    | 'MIGRATE' | string;
  executedBy: 'USER' | 'AGENT';
  vaultVersion: string;
  chainId: number;
  signal?: string | null;
  amount?: number | null;
  token?: string | null;
  fromVault?: { name: string; address: string; apy: number } | null;
  toVault?: { name: string; address: string; apy: number } | null;
  apyBefore?: number | null;
  apyAfter?: number | null;
}

interface AgentMessagesResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
  messages: AgentMessage[];
}
```

### Exported types table

Key types exported from `@surf_liquid/surf-widget`:

| Type | Description |
|---|---|
| `SurfWidgetProps` | Props for `<SurfWidget>` |
| `SurfConfig` | Config object for `SurfProvider` |
| `SurfContextValue` | Value returned by `useSurf()` |
| `SurfTheme` | Theme customization shape |
| `VaultInfo` | Widget-normalized vault state |
| `VaultActivity` | Normalized agent message / activity entry |
| `VaultDeposit` | A single deposit entry (used in the deposits tab) |
| `DepositStep` | Discriminated union of deposit flow steps |
| `WithdrawStep` | Discriminated union of withdraw flow steps |
| `AgentMessage` | Raw activity entry from the API (see expanded fields below) |
| `AgentMessagesResult` | Paginated wrapper: `{ page, limit, total, pages, messages: AgentMessage[] }` |
| `ISurfClient` | Interface the widget consumes from the client |
| `ButtonProps` | Props for `<Button>` |
| `ButtonVariant` | `'primary' \| 'outline' \| 'ghost' \| 'soft'` |
| `ButtonSize` | `'sm' \| 'md' \| 'lg'` |
| `StepStatus` | `'pending' \| 'active' \| 'completed' \| 'error'` |
| `Step` | A single step for `<StepProgress>` |
| `Tab` | A tab entry `{ id, label }` |
| `TokenInfo` | Token metadata `{ symbol, name, icon?, decimals, address }` |
| `ChainInfo` | Chain metadata `{ name, id }` |
| `SurfProviderProps` | Props for `<SurfProvider>`: `{ config, containerRef, children }` |
| `VaultCardProps` | Props for `<VaultCard>` |
| `DepositModalProps` | Props for `<DepositModal>` |
| `WithdrawModalProps` | Props for `<WithdrawModal>` |
| `VaultActivityModalProps` | Props for `<VaultActivityModal>` |
| `ManageDropdownProps` | Props for `<ManageDropdown>` |
| `ModalProps` | Props for the generic `<Modal>` |
| `TokenIconProps` | Props for `<TokenIcon>` |
| `RegistrationFormProps` | Props for `<RegistrationForm>` |
| `SurfVaultAsset` | Raw per-asset entry inside `SurfVaultInfo.assets[]` |

## CSS import

The widget ships compiled Tailwind CSS that is **not** auto-injected. You must import it once, typically at your app entry point:

```ts
import '@surf_liquid/surf-widget/dist/index.css';
```

If the widget renders but looks completely unstyled (plain HTML), this import is missing.

**Tailwind config note:** if your app also uses Tailwind, the widget's CSS file is self-contained and separate — there is no `content` array collision to worry about. Two separate CSS files will both apply.

## Gotchas & footguns

**1. Must authenticate before rendering.**
The widget calls `client.getVault()` on mount. That call goes to the REST API, which requires the session cookie. If you render `<SurfWidget>` without calling `client.authenticate()` first, the vault fetch returns 401 and the widget shows an empty/error state.

**2. `chainId` prop must match the client's configured chain.**
The widget uses `chainId` to call `client.getSupportedAssets(chainId)` and resolve vault data. If `chainId` differs from what you passed to `SurfClient.create({ chainId: ... })`, asset resolution will fail. Keep them in sync.

**3. `client` prop should not be recreated on every render.**
`SurfClient.create(...)` is synchronous but heavy. If you call it inside a React render function without memoization, the widget will re-mount and re-fetch on every render. Compute the client once (in a `useState` initializer, `useMemo`, or module scope) and hold a stable reference.

**4. CSS import is mandatory.**
Without `import '@surf_liquid/surf-widget/dist/index.css'`, the widget renders unstyled raw HTML. Always import the CSS in your app's entry file, NOT inside a component (otherwise it loads every time the component mounts).

**5. `useDeposit` / `useWithdraw` / other hooks require `SurfProvider`.**
If you call these hooks outside of a `SurfProvider` tree, they throw. `<SurfWidget>` provides the context, so hooks work in any component *rendered inside* `SurfWidget`'s children — but you cannot call them in a sibling or parent component. For that pattern, use `SurfProvider` directly.

**6. `useDepositBalance` vs `useWithdrawableBalance` — two different balances.**
`useDepositBalance` → wallet's ERC-20 balance (`balanceOf`). Shows how much the user *has* to deposit.
`useWithdrawableBalance` → vault's holdings for that asset. Shows how much the user *can* withdraw.
Mixing these up causes confusing UI (e.g. showing vault balance in the deposit input).

**7. `VaultInfo` is the widget's normalized type, not the raw SDK type.**
`client.getVault()` returns `SurfVaultInfo` (raw SDK shape). The hooks transform that into the widget's `VaultInfo` shape. Sub-components and hooks expect the widget's `VaultInfo`, not the raw SDK type. Don't pass `SurfVaultInfo` directly to `<VaultCard>`.

**8. `withdraw` with no amount = full withdrawal.**
`execute("0", vault)` on `useWithdraw` triggers a full withdrawal. There is no separate "withdraw all" method.

**9. `RegistrationForm` is for developer onboarding, not end-user auth.**
`RegistrationForm` creates a new SurfLiquid *app registration* (gets an `appId` + `apiSecret`). It is not a user login form. Don't render it in a user-facing deposit/withdraw flow.

**10. `client.getAgentMessages()` returns `AgentMessagesResult`, not `AgentMessage[]`.**
The raw client method returns `{ page, limit, total, pages, messages: AgentMessage[] }`. If you call it directly (outside `useAgentMessages`), access `.messages` to get the array. `useAgentMessages` handles this unwrapping internally.

**11. `WithdrawStep` has no `redeeming_reward` state.**
The withdraw flow only transitions through `closing_position` → `success` (or `error`). There is no `redeeming_reward` step. Don't branch on it in step-progress UIs.

## Integration checklist

- [ ] `npm install @surf_liquid/surf-widget @surf_liquid/core-sdk ethers`
- [ ] `import '@surf_liquid/surf-widget/dist/index.css'` at app entry (once, not in a component)
- [ ] `SurfClient.create(...)` called once, result stored in stable state (not recreated on render)
- [ ] `client.connectWallet(...)` awaited before rendering `<SurfWidget>`
- [ ] `client.authenticate()` awaited before rendering `<SurfWidget>`
- [ ] `chainId` prop on `<SurfWidget>` matches `chainId` passed to `SurfClient.create(...)`
- [ ] `walletAddress` prop on `<SurfWidget>` is the connected EOA string (from `connectWallet` result)
- [ ] If using custom hooks (`useDeposit`, `useVault`, etc.) outside `SurfWidget`, wrap with `SurfProvider` and provide a `containerRef`
- [ ] VITE_APP_ID (or equivalent) set in `.env` — the demo reads `import.meta.env.VITE_APP_ID`

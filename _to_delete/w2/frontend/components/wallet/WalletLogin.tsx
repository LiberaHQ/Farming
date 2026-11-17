'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  ConnectButton,
  connectorsForWallets,
  createAuthenticationAdapter,
  darkTheme,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  type AuthenticationStatus,
} from '@rainbow-me/rainbowkit';
import { coinbaseWallet, injectedWallet, metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { createSiweMessage } from 'viem/siwe';
import { createConfig, http, useAccount, useDisconnect, useSwitchChain, WagmiProvider } from 'wagmi';
import { disconnect as disconnectCore } from 'wagmi/actions';
import { arbitrum, avalanche, base, baseSepolia, bsc, gnosis, hardhat, linea, mainnet, optimism, polygon, polygonAmoy, scroll, sepolia, zksync } from 'wagmi/chains';

/**
 * "Sign in with wallet": RainbowKit connects the wallet (MetaMask and friends),
 * then the player signs a Sign-In with Ethereum message. The backend checks the
 * signature and starts the same session cookie a password login does.
 *
 * WalletConnect (phone wallets, QR codes) needs a free project id from
 * https://cloud.reown.com in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Without one,
 * browser-extension wallets like MetaMask still work.
 */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';
const hasWalletConnect = projectId.length > 0;

/**
 * Signing in works on any of these networks (the chain id only goes into the
 * signed message). RainbowKit refuses to sign on a network it doesn't know, so
 * the list is broad, and a wallet on anything else is asked to switch.
 */
const chains = [mainnet, base, baseSepolia, sepolia, polygon, polygonAmoy, optimism, arbitrum, bsc, linea, avalanche, zksync, scroll, gnosis, hardhat] as const;

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: hasWalletConnect ? [metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet] : [metaMaskWallet, coinbaseWallet, injectedWallet],
    },
  ],
  { appName: 'Valley', projectId: projectId || 'valley-no-walletconnect' },
);

const wagmiConfig = createConfig({
  connectors,
  chains,
  transports: Object.fromEntries(chains.map((c) => [c.id, http()])) as Record<(typeof chains)[number]['id'], ReturnType<typeof http>>,
  ssr: true,
});

const queryClient = new QueryClient();

/** Lets go of the connected wallet (used when logging out from the menu). */
export async function disconnectWallet(): Promise<void> {
  await disconnectCore(wagmiConfig).catch(() => undefined);
}

const theme = darkTheme({
  accentColor: '#f4d24a',
  accentColorForeground: '#2b1d1a',
  borderRadius: 'small',
  fontStack: 'system',
  overlayBlur: 'small',
});
theme.colors.modalBackground = '#231b16';
theme.colors.modalBorder = '#6f4626';
theme.colors.modalText = '#f6efe0';
theme.colors.modalTextSecondary = '#cdbf9f';
theme.fonts.body = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

interface WalletLoginProps {
  /** Whether the player has a session right now (from useSession). */
  signedIn: boolean | undefined;
  /** Called after the backend accepts the signature (refresh the session). */
  onSignedIn: () => void | Promise<void>;
  /** Called after the wallet signs out. */
  onSignedOut?: () => void | Promise<void>;
  label?: string;
  className?: string;
}

export function WalletLogin(props: WalletLoginProps) {
  const callbacks = useRef(props);
  callbacks.current = props;

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const res = await fetch('/api/auth/siwe/nonce', { credentials: 'include' });
          if (!res.ok) throw new Error('Could not start wallet sign-in.');
          return res.text();
        },
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            domain: window.location.host,
            address,
            statement: 'Sign in to Valley. This only proves you own this wallet — it costs nothing and sends no transaction.',
            uri: window.location.origin,
            version: '1',
            chainId,
            nonce,
            issuedAt: new Date(),
            expirationTime: new Date(Date.now() + 10 * 60_000),
          }),
        verify: async ({ message, signature }) => {
          const res = await fetch('/api/auth/siwe/verify', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, signature }),
          });
          if (res.ok) await callbacks.current.onSignedIn();
          return res.ok;
        },
        signOut: async () => {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
          await callbacks.current.onSignedOut?.();
        },
      }),
    [],
  );

  const status: AuthenticationStatus = props.signedIn === undefined ? 'loading' : props.signedIn ? 'authenticated' : 'unauthenticated';

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
          <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: 'Valley' }}>
            <WalletButton signedIn={props.signedIn} label={props.label} className={props.className} />
          </RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletButton({ signedIn, label = '🦊 Sign in with wallet', className = 'btn btn-wallet' }: { signedIn: boolean | undefined; label?: string; className?: string }) {
  const { isConnected, chain, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // A wallet on a network we don't list can't sign in; ask it to move to Ethereum.
  const unsupported = isConnected && chainId !== undefined && !chain;
  useEffect(() => {
    if (unsupported) switchChain({ chainId: mainnet.id });
  }, [unsupported, switchChain]);
  const was = useRef(signedIn);

  // Logging out elsewhere (the Log out button) also lets go of the wallet.
  useEffect(() => {
    if (was.current && signedIn === false && isConnected) disconnect();
    was.current = signedIn;
  }, [signedIn, isConnected, disconnect]);

  return (
    <ConnectButton.Custom>
      {({ account, chain: rkChain, openConnectModal, openAccountModal, openChainModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        if (!ready) return <button type="button" className={className} disabled>{label}</button>;
        if (account && rkChain?.unsupported) {
          return (
            <button type="button" className={className} onClick={openChainModal} title="Your wallet is on a network Valley doesn't know">
              🦊 Switch network to sign in
            </button>
          );
        }
        if (account && authenticationStatus === 'authenticated') {
          return (
            <button type="button" className={className} onClick={openAccountModal} title="Wallet details">
              🦊 {account.displayName}
            </button>
          );
        }
        // Connected but not signed yet: the button re-opens the signing step.
        return (
          <button type="button" className={className} onClick={openConnectModal}>
            {account ? '🦊 Finish wallet sign-in' : label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

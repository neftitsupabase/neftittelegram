import React from "react";
import {
  ThirdwebProvider as TwProvider,
  metamaskWallet,
  walletConnect,
  coinbaseWallet,
} from "@thirdweb-dev/react";
import { Ethereum, Polygon, Optimism, Base, Fantom } from "@thirdweb-dev/chains";

interface ThirdwebProviderProps {
  children: React.ReactNode;
}

export function ThirdwebProvider({ children }: ThirdwebProviderProps) {
  const supportedChains = [Ethereum, Polygon, Optimism, Base, Fantom];
  const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID || "";
  const authDomain = import.meta.env.VITE_AUTH_DOMAIN || window.location.origin;

  return (
    <TwProvider
      clientId={clientId}
      supportedChains={supportedChains}
      supportedWallets={[
        metamaskWallet(),
        walletConnect({
          projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
          qrModal: 'walletConnect',
          qrModalOptions: {
            themeMode: 'dark',
            themeVariables: {
              '--wcm-z-index': '9999999',
            },
          },
        }),
        coinbaseWallet(),
      ]}
      dAppMeta={{
        name: "NEFTIT",
        description: "Discover, trade, and showcase unique digital assets in the metaverse",
        logoUrl: "/images/logo.png", // Replace with your actual logo
        url: authDomain,
      }}
    >
      {children}
    </TwProvider>
  );
}

export default ThirdwebProvider;

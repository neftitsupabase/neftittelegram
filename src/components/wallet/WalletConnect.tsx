import { useConnect, walletConnect } from "@thirdweb-dev/react";
import { Button } from "@/components/ui/button";

export function WalletConnect({ onBeforeConnect }: { onBeforeConnect?: () => void }) {
  const connect = useConnect();
  const walletConnectConfig = walletConnect({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
    qrModalOptions: {
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '9999999',
      },
    },
  });

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={() => {
        if (onBeforeConnect) onBeforeConnect();
        setTimeout(() => connect(walletConnectConfig), 200);
      }}
    >
      <span role="img" aria-label="WalletConnect">🔗</span>
      <span>WalletConnect</span>
    </Button>
  );
}

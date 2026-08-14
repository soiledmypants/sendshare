import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import {
  robinhoodChain,
  rpcUrl,
  walletConnectProjectId,
} from "@/config";

const connectors = walletConnectProjectId
  ? [
      injected({ shimDisconnect: true }),
      walletConnect({ projectId: walletConnectProjectId, showQrModal: true }),
    ]
  : [injected({ shimDisconnect: true })];

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors,
  transports: {
    [robinhoodChain.id]: http(rpcUrl),
  },
  ssr: true,
});

import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import React from "react";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ 
        network: Network.TESTNET, 
        aptosApiKeys: { 
          [Network.TESTNET]: process.env.APTOS_API_KEY || ""
        } 
      }}
      onError={(error: Error) => {
        console.log("error", error);
      }}
    >
      <Component {...pageProps} />
    </AptosWalletAdapterProvider>
  );
}

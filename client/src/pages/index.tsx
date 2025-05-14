import Head from "next/head";
import { Geist } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function Home() {
  const { connect, wallets } = useWallet();
  const [extensionConflict, setExtensionConflict] = useState(false);

  useEffect(() => {
    // Check if window.ethereum exists and is not writable
    // This indicates a potential conflict with MetaMask or other Ethereum wallets
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (descriptor && descriptor.get && !descriptor.set) {
      setExtensionConflict(true);
    }
  }, []);

  const onConnect = async (walletName: string) => {
    try {
      await connect(walletName);
    } catch (error) {
      console.error("Connection error:", error);
      // Check if the error is related to window.ethereum conflicts
      if (error instanceof Error && error.message.includes("ethereum")) {
        setExtensionConflict(true);
      }
    }
  };

  return (
    <>
      <Head>
        <title>Wallet Connect</title>
        <meta name="description" content="Connect your wallet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={`${styles.page} ${geistSans.variable}`}>
        <main className={styles.main}>
          <h1>Connect Your Wallet</h1>
          
          {extensionConflict && (
            <div style={{ color: 'red', padding: '15px', margin: '15px 0', border: '1px solid red', borderRadius: '5px' }}>
              <h3>Browser Extension Conflict Detected</h3>
              <p>It appears you have multiple wallet extensions installed that are conflicting with each other.</p>
              <p>Try:</p>
              <ul>
                <li>Temporarily disabling MetaMask or other Ethereum wallet extensions</li>
                <li>Using incognito mode or a new browser profile with only Aptos wallet extensions</li>
              </ul>
            </div>
          )}
          
          <div className={styles.ctas}>
            {wallets.map((wallet) => (
              <button 
                key={wallet.name}
                onClick={() => onConnect(wallet.name)} 
                className={styles.primary}
              >
                {wallet.name}
              </button>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}

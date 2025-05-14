import Head from "next/head";
import { Geist } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function Home() {
  const { connect, disconnect, wallets, connected, account } = useWallet();
  const [extensionConflict, setExtensionConflict] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  
  
  useEffect(() => {
    // Check if window.ethereum exists and is not writable
    // This indicates a potential conflict with MetaMask or other Ethereum wallets
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (descriptor && descriptor.get && !descriptor.set) {
      setExtensionConflict(true);
    }
    console.log("window.ethereum");

  }, []);

  useEffect(() => {
    console.log("Available wallets:", wallets.map(w => w.name));
  }, [wallets]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && account?.address) {
        try {
          // Balance placeholder  (Refere to Aptos SDK))
          // Test--> will implement soon 
          // const resources = await client.getAccountResources(account.address)
          
          setBalance("1.234");
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    };

    fetchBalance();
  }, [connected, account]);

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

  const onDisconnect = async () => {
    try {
      await disconnect();
      window.location.reload();
    } catch (error) {
      console.error("Disconnection error:", error);
    }
  };

  const petraWallet = wallets.find(wallet => 
    wallet.name.toLowerCase().includes("petra")
  );

  return (
    <>
      <Head>
        <title>Pixel Board | Wallet Connect</title>
        <meta name="description" content="Connect your wallet to the Pixel Board app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={`${styles.page} ${geistSans.variable}`}>
        <div className={styles.topNav}>
          {!connected ? (
            <button 
              onClick={() => petraWallet ? onConnect(petraWallet.name) : null}
              className={styles.topConnectButton}
              disabled={!petraWallet}
            >
              {petraWallet ? (
                <>
                  {petraWallet.icon && (
                    <Image 
                      src={petraWallet.icon}
                      alt="Petra wallet icon"
                      width={20}
                      height={20}
                      className={styles.buttonIcon}
                    />
                  )}
                  Connect Wallet
                </>
              ) : "Petra Wallet Not Found"}
            </button>
          ) : (
            <div className={styles.topConnectedInfo}>
              {balance !== null && (
                <span className={styles.balanceBadge}>
                  {parseFloat(balance).toFixed(3)} APT
                </span>
              )}
              <span className={styles.addressBadge}>
                {account?.address ? 
                  `${account.address.toString().slice(0, 6)}...${account.address.toString().slice(-4)}` : 
                  'Address unavailable'}
              </span>
              <button 
                onClick={onDisconnect}
                className={styles.topDisconnectButton}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Pixel Board</h1>
            <p className={styles.subtitle}>Connect your wallet to start placing pixels</p>
          </div>
          
          {extensionConflict && (
            <div className={styles.alert}>
              <h3>Browser Extension Conflict Detected</h3>
              <p>It appears you have multiple wallet extensions installed that are conflicting with each other.</p>
              <p>Try:</p>
              <ul>
                <li>Temporarily disabling MetaMask or other Ethereum wallet extensions</li>
                <li>Using incognito mode or a new browser profile with only Aptos wallet extensions</li>
              </ul>
            </div>
          )}
          
          <div className={styles.walletSection}>
            {!connected ? (
              <>
                <h2>Select a Wallet</h2>
                <div className={styles.walletGrid}>
                  {wallets
                    .filter(wallet => !wallet.name.toLowerCase().includes("apple"))
                    .map((wallet) => (
                    <button 
                      key={wallet.name}
                      onClick={() => onConnect(wallet.name)} 
                      className={styles.walletButton}
                    >
                      {wallet.icon ? (
                        <div className={styles.walletIcon}>
                          <Image 
                            src={wallet.icon}
                            alt={`${wallet.name} icon`}
                            width={24}
                            height={24}
                          />
                        </div>
                      ) : (
                        <div className={styles.walletIcon}>
                          <div className={styles.defaultWalletIcon}></div>
                        </div>
                      )}
                      <span>{wallet.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.connectedState}>
                <div className={styles.accountInfo}>
                  <h2>Connected</h2>
                  <p className={styles.address}>
                    {account?.address ? 
                      `${account.address.toString().slice(0, 6)}...${account.address.toString().slice(-4)}` : 
                      'Address unavailable'}
                  </p>
                </div>
                <button 
                  className={styles.enterAppButton}
                  onClick={() => window.location.href = '/board'}
                >
                  Enter Pixel Board
                </button>
              </div>
            )}
          </div>
          
          <div className={styles.footer}>
            <p>Powered by Aptos</p>
          </div>
        </main>
      </div>
    </>
  );
}

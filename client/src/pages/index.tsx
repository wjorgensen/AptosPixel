import Head from "next/head";
import { Geist } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import React, { useEffect, useState } from "react";
import { AptosClient } from "aptos";
import PixelCanvas from "@/components/PixelCanvas";
import { PixelBoardClient } from '@/blockchain/PixelBoardClient';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function Home() {
  const { connect, disconnect, wallets, connected, account } = useWallet();
  const [extensionConflict, setExtensionConflict] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pixelBoardClient, setPixelBoardClient] = useState<PixelBoardClient | null>(null);

  // Update canvas size based on window size
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth * 0.9, 1200);
      const height = Math.min(window.innerHeight * 0.6, 800);
      setCanvasSize({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check for extension conflicts
  useEffect(() => {
    // Check if window.ethereum exists and is not writable
    // This indicates a potential conflict with MetaMask or other Ethereum wallets
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (descriptor && descriptor.get && !descriptor.set) {
      setExtensionConflict(true);
    }
  }, []);

  //replace with actual aptos balance 
  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && account?.address) {
        try {
          const client = new AptosClient(process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com");
          const resources = await client.getAccountResources(account.address.toString());
          const aptosCoinResource = resources.find(
            (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
          );
          
          if (aptosCoinResource) {
            // @ts-ignore 
            const coinBalance = aptosCoinResource.data.coin.value;
            setBalance((parseInt(coinBalance) / 100000000).toFixed(4));
          }
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance("Error");
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
      setShowModal(false); 
    } catch (error) {
      console.error("Connection error:", error);
      if (error instanceof Error && error.message.includes("ethereum")) {
        setExtensionConflict(true);
      }
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    const nodeUrl = process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com";
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xpixel_board_admin'; // replace with deployed contract address
    
    const client = new PixelBoardClient(nodeUrl, contractAddress);
    setPixelBoardClient(client);
  }, []);

  return (
    <>
      <Head>
        <title>AptosPixel</title>
        <meta name="description" content="Decentralized pixel art on Aptos blockchain" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.navbar}>
        <div className={styles.navbarLogo}>
          <span>AptosPixel</span>
        </div>
        <div className={styles.navbarRight}>
          {connected && account ? (
            <div className={styles.walletInfo}>
              <div className={styles.walletAddress}>
                {truncateAddress(account.address.toString())}
              </div>
              {balance && (
                <div className={styles.walletBalance}>
                  {balance} APT
                </div>
              )}
              <button 
                onClick={disconnect} 
                className={`${styles.walletButton} ${styles.disconnectButton}`}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowModal(true)} 
              className={styles.walletButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.walletIcon}>
                <path d="M19.5 7.5H4.5C3.67157 7.5 3 8.17157 3 9V18C3 18.8284 3.67157 19.5 4.5 19.5H19.5C20.3284 19.5 21 18.8284 21 18V9C21 8.17157 20.3284 7.5 19.5 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.5 15.5C17.0523 15.5 17.5 15.0523 17.5 14.5C17.5 13.9477 17.0523 13.5 16.5 13.5C15.9477 13.5 15.5 13.9477 15.5 14.5C15.5 15.0523 15.9477 15.5 16.5 15.5Z" fill="currentColor"/>
                <path d="M18 7.5V6C18 5.46957 17.7893 4.96086 17.4142 4.58579C17.0391 4.21071 16.5304 4 16 4H8C7.46957 4 6.96086 4.21071 6.58579 4.58579C6.21071 4.96086 6 5.46957 6 6V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.page} ${geistSans.variable}`}>
        <main className={styles.main}>
          <h1>AptosPixel Board</h1>
         
          
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
          
          <div className={styles.canvasContainer}>
            <PixelCanvas 
              width={canvasSize.width} 
              height={canvasSize.height} 
              pixelBoardClient={pixelBoardClient || undefined}
            />
          </div>
          
          {!connected && (
            <div className={styles.connectPrompt}>
              <button 
                onClick={() => setShowModal(true)} 
                className={styles.connectButton}
              >
                Connect Wallet to Place Pixels
              </button>
            </div>
          )}
     
          {showModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <h2>Connect Your Wallet</h2>
                  <button 
                    className={styles.closeButton}
                    onClick={() => setShowModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalContent}>
                  <div className={styles.walletOptions}>
                    {wallets.map((wallet) => (
                      <button 
                        key={wallet.name}
                        onClick={() => onConnect(wallet.name)} 
                        className={styles.walletOption}
                      >
                        {wallet.icon && (
                          <img 
                            src={wallet.icon} 
                            alt={`${wallet.name} icon`}
                            className={styles.walletIcon}
                          />
                        )}
                        <span>{wallet.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
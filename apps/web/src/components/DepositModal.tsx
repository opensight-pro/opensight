import React from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect, useConnectors } from "wagmi";
import { formatEther, parseEther } from "viem";

import { useDeposit } from "../hooks/useDeposit";
import { useChainSwitch } from "../hooks/useChainSwitch";
import { getExplorerTxUrl } from "../lib/format";
import PaymentABI from "../abi/Payment.json";
import { appChain } from "../lib/wagmi";

const PAYMENT_CONTRACT_ADDRESS = import.meta.env.VITE_PAYMENT_CONTRACT_ADDRESS as string | undefined;
const BNB_TO_COIN_RATE = 1000;

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSuccess: () => void;
}

type DepositStep = "input" | "intent" | "transact" | "confirm" | "success" | "error";

export function DepositModal({ isOpen, onClose, apiKey, onSuccess }: DepositModalProps) {
  const { address, isConnected } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending: isConnecting } = useConnect();

  const {
    writeContract,
    isPending: isWritePending,
    data: hash,
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
    hash
  });

  const { depositIntent, depositConfirm, loading: apiLoading, error: apiError, refresh } = useDeposit(apiKey);
  const { isCorrectChain, isSwitching, switchToTargetChain, targetChainId } = useChainSwitch();

  const [bnbAmount, setBnbAmount] = React.useState<string>("");
  const [step, setStep] = React.useState<DepositStep>("input");
  const [requestId, setRequestId] = React.useState<string>("");
  const [txHash, setTxHash] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  const coinAmount = React.useMemo(() => {
    const bnb = parseFloat(bnbAmount);
    if (!Number.isFinite(bnb) || bnb <= 0) return 0;
    return Math.floor(bnb * BNB_TO_COIN_RATE);
  }, [bnbAmount]);

  const isValidInput = React.useMemo(() => {
    const bnb = parseFloat(bnbAmount);
    return Number.isFinite(bnb) && bnb > 0;
  }, [bnbAmount]);

  const handleConnect = () => {
    const connector = connectors.at(0);
    if (connector) {
      connector.connect();
    } else {
      setError("MetaMask not detected. Please install MetaMask.");
    }
  };

  const handleStartDeposit = async () => {
    if (!isValidInput) return;

    setError("");
    setStep("intent");

    if (!address) {
      setError("Wallet address not available");
      setStep("error");
      return;
    }

    const result = await depositIntent({ walletAddress: address });
    if (result) {
      setRequestId(result.requestId);
      setStep("transact");
    } else {
      setStep("error");
      setError(apiError || "Failed to create deposit intent");
    }
  };

  const handleContractDeposit = async () => {
    if (!PAYMENT_CONTRACT_ADDRESS) {
      setError("Payment contract address not configured");
      setStep("error");
      return;
    }

    if (!isCorrectChain) {
      setError(`Please switch to ${appChain.name} (Chain ID: ${targetChainId})`);
      const switched = await switchToTargetChain();
      if (!switched) {
        setError(`Failed to switch to ${appChain.name}. Please switch manually in MetaMask.`);
        setStep("error");
        return;
      }
    }

    setError("");

    try {
      const value = parseEther(bnbAmount);
      writeContract({
        address: PAYMENT_CONTRACT_ADDRESS as `0x${string}`,
        abi: PaymentABI,
        functionName: "deposit",
        value
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate transaction");
      setStep("error");
    }
  };

  React.useEffect(() => {
    if (isConfirmed && hash) {
      setTxHash(hash);
      setStep("confirm");
      const bnbAmountWei = parseEther(bnbAmount).toString();
      depositConfirm({ requestId, txHash: hash, walletAddress: address!, bnbAmountWei }).then((result) => {
        if (result) {
          setStep("success");
        } else {
          setStep("error");
          setError(apiError || "Failed to confirm deposit");
        }
      });
    }
  }, [isConfirmed, hash, requestId, depositConfirm, apiError]);

  React.useEffect(() => {
    if (writeError) {
      setError(writeError.message);
      setStep("error");
    } else if (confirmError) {
      setError(confirmError.message);
      setStep("error");
    }
  }, [writeError, confirmError]);

  const handleClose = () => {
    setBnbAmount("");
    setStep("input");
    setRequestId("");
    setTxHash("");
    setError("");
    resetWrite();
    refresh();
    onClose();
  };

  const handleSuccessClose = () => {
    onSuccess();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-text-main font-semibold">Deposit BNB</h3>
          </div>
          <button onClick={handleClose} className="text-text-secondary hover:text-text-main transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {(error || apiError) && (
            <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error || apiError}</span>
            </div>
          )}

          {/* Step: Input */}
          {step === "input" && (
            <>
              {!isConnected ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary mb-4">Connect your wallet to deposit BNB</p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg-main font-semibold rounded-lg transition-colors"
                  >
                    {isConnecting ? "Connecting…" : "Connect Wallet"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                    <div className="flex items-center gap-2 text-success text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Wallet Connected</span>
                    </div>
                    <p className="text-text-secondary text-xs mt-1 font-mono truncate">{address}</p>
                  </div>

                  {!isCorrectChain && (
                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                      <div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Wrong Network</span>
                      </div>
                      <p className="text-text-secondary text-xs mb-3">
                        Please switch to <span className="text-text-main">{appChain.name}</span>
                      </p>
                      <button
                        onClick={switchToTargetChain}
                        disabled={isSwitching}
                        className="w-full py-2 bg-warning/20 hover:bg-warning/30 text-warning text-sm font-medium rounded-lg transition-colors"
                      >
                        {isSwitching ? "Switching…" : `Switch to ${appChain.name}`}
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs text-text-secondary uppercase font-medium">Amount (BNB)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="0.00"
                      value={bnbAmount}
                      onChange={(e) => setBnbAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-main placeholder-text-tertiary focus:border-primary focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  {isValidInput && (
                    <div className="p-4 bg-bg-secondary rounded-lg">
                      <div className="text-xs text-text-secondary uppercase mb-2">Conversion Preview</div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-main font-mono">{parseFloat(bnbAmount).toFixed(4)} BNB</span>
                        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-success font-bold font-mono">{coinAmount.toLocaleString()} Coin</span>
                      </div>
                      <p className="text-text-tertiary text-xs mt-2">Rate: 1 BNB = 1000 Coin</p>
                    </div>
                  )}

                  <button
                    onClick={handleStartDeposit}
                    disabled={!isValidInput || apiLoading || !isCorrectChain}
                    className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg-main font-semibold rounded-lg transition-colors"
                  >
                    {apiLoading ? "Preparing…" : "Deposit"}
                  </button>
                </>
              )}
            </>
          )}

          {/* Step: Intent */}
          {step === "intent" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-main font-medium">Creating deposit intent...</p>
              <p className="text-text-secondary text-sm mt-1">Please wait while we prepare your deposit</p>
            </div>
          )}

          {/* Step: Transact */}
          {step === "transact" && (
            <div className="space-y-4">
              <div className="p-4 bg-bg-secondary rounded-lg">
                <p className="text-xs text-text-secondary uppercase mb-1">Request ID</p>
                <code className="text-sm text-text-main font-mono break-all">{requestId}</code>
              </div>

              <div className="p-4 bg-bg-secondary rounded-lg">
                <p className="text-xs text-text-secondary uppercase mb-1">Amount</p>
                <p className="text-text-main font-mono">
                  {parseFloat(bnbAmount).toFixed(4)} BNB = <span className="text-success">{coinAmount.toLocaleString()} Coin</span>
                </p>
              </div>

              <button
                onClick={handleContractDeposit}
                disabled={isWritePending}
                className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg-main font-semibold rounded-lg transition-colors"
              >
                {isWritePending ? "Confirm in Wallet..." : "Send Transaction"}
              </button>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 border-2 border-success/30 border-t-success rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-main font-medium">Confirming transaction...</p>
              <p className="text-text-secondary text-sm mt-1">Waiting for blockchain confirmation</p>
              {txHash && (
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary-hover text-sm mt-4"
                >
                  View on Explorer
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-success/10 border border-success/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-success font-bold text-lg">Deposit Successful!</p>
                <p className="text-text-secondary text-sm mt-1">
                  {coinAmount.toLocaleString()} Coin has been added to your balance
                </p>
              </div>

              {txHash && (
                <div className="p-4 bg-bg-secondary rounded-lg">
                  <p className="text-xs text-text-secondary uppercase mb-1">Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-text-main font-mono break-all flex-1">{txHash}</code>
                    <a
                      href={getExplorerTxUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={handleSuccessClose}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-bg-main font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-danger/10 border border-danger/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-danger font-bold text-lg">Deposit Failed</p>
                <p className="text-text-secondary text-sm mt-1">Something went wrong. Please try again.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("input")}
                  className="flex-1 py-3 bg-surface hover:bg-surface-hover border border-border text-text-main font-semibold rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-bg-main font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-bg-secondary flex justify-between text-xs text-text-tertiary">
          <span>BNB CHAIN</span>
          <span>Chain ID: {appChain.id}</span>
        </div>
      </div>
    </div>
  );
}

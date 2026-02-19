import { useAccount, useSwitchChain } from "wagmi";
import { appChain } from "../lib/wagmi";

/**
 * Hook to ensure user is on the correct chain
 * Returns functions to check and switch chain
 */
export function useChainSwitch() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const targetChainId = appChain.id;
  const isCorrectChain = chainId === targetChainId;

  const switchToTargetChain = async (): Promise<boolean> => {
    if (!isConnected) {
      return false;
    }

    if (isCorrectChain) {
      return true;
    }

    try {
      await switchChain({ chainId: targetChainId });
      return true;
    } catch (error) {
      console.error("Failed to switch chain:", error);
      return false;
    }
  };

  return {
    chainId,
    targetChainId,
    isCorrectChain,
    isSwitching,
    isConnected,
    switchToTargetChain
  };
}

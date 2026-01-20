import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";
import { PoolToken } from "@/components/gauge/types";

export function useCommittedPositions(poolAddress: string) {
  const normalizedPoolAddress = poolAddress.toLowerCase();

  return useQuery({
    queryKey: ["gauge-committed-positions", normalizedPoolAddress],
    enabled: Boolean(TAPP_ACCOUNT_ADDRESS && poolAddress),
    queryFn: async (): Promise<PoolToken[]> => {
      if (!TAPP_ACCOUNT_ADDRESS) {
        return [];
      }
      const vaultAddress = deriveVaultAddress(TAPP_ACCOUNT_ADDRESS, "VAULT");
      const collectionAddress = deriveCollectionAddress(vaultAddress, "TAPP").toString();

      return aptosClient().getAccountOwnedTokensFromCollectionAddress({
        accountAddress: poolAddress,
        collectionAddress,
        options: { limit: 200 },
      });
    },
  });
}

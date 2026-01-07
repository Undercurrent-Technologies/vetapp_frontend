import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { TAPP_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";

type PositionsQueryResult = {
  collectionAddress: string | null;
  tokens: {
    token_data_id: string;
    amount: any;
    current_token_data?: {
      token_name: string;
    } | null;
  }[];
};

export function UserLocks() {
  const { account } = useWallet();

  const { data, isFetching, error } = useQuery({
    queryKey: ["user-locks", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<PositionsQueryResult> => {
      if (!account) {
        return { collectionAddress: null, tokens: [] };
      }

      let vaultAddress = deriveVaultAddress(VETAPP_ACCOUNT_ADDRESS, "VE_TAPP");
      let collectionAddress = deriveCollectionAddress(vaultAddress, "veTAPP").toString();
      console.log(collectionAddress);

      const tokens = await aptosClient().getAccountOwnedTokensFromCollectionAddress({
        accountAddress: account.address,
        collectionAddress,
        options: { limit: 200 },
      });

      return { collectionAddress, tokens };
    },
  });

  const tokens = data?.tokens ?? [];
  const shorten = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`;
  const onCopy = async (data: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(data);
      toast({
        title: "Copied",
        description: data,
      });
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <h4 className="text-lg font-medium">User locks</h4>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground">
            Collection address: {data?.collectionAddress ?? "unknown"}
          </div>
          <div className="flex flex-col gap-2">
            {tokens.map((token) => (
              <span key={token.token_data_id}>
                {token.current_token_data?.token_name} :
                <code
                  className="border border-input rounded px-2 py-1"
                  onClick={() => onCopy(token.token_data_id)}
                >
                  {shorten(token.token_data_id)}
                </code>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

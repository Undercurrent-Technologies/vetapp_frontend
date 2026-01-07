import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";
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

export function UserPositions() {
  const { account } = useWallet();

  const { data, isFetching, error } = useQuery({
    queryKey: ["user-positions", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<PositionsQueryResult> => {
      if (!account) {
        return { collectionAddress: null, tokens: [] };
      }
      let vaultAddress = deriveVaultAddress(TAPP_ACCOUNT_ADDRESS, "VAULT");
      let collectionAddress = deriveCollectionAddress(vaultAddress, "TAPP").toString();
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
  const groupedTokens = tokens.reduce((acc, token) => {
    let name = token.current_token_data?.token_name ?? token.token_data_id;
    name = name.slice(1, 67);
    const key = shorten(name);
    const entry = acc.get(key);
    if (entry) {
      entry.tokens.push(token);
    } else {
      acc.set(key, { name, tokens: [token] });
    }
    return acc;
  }, new Map<string, { name: string; tokens: typeof tokens }>());

  return (
    <div className="flex flex-col gap-6">
      <h4 className="text-lg font-medium">User positions</h4>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground">
            Collection address: {data?.collectionAddress ?? "unknown"}
          </div>
          <div className="flex flex-col gap-2">
            {[...groupedTokens.entries()].map(([key, group]) => (
              <div key={key} className="flex flex-col gap-1">
                <h3>
                  <span>Pool: </span>
                  <code
                    className="border border-input rounded px-2 py-1"
                    onClick={() => onCopy(group.name)}
                  >
                    {key}
                  </code>
                </h3>

                {group.tokens.map((token) => (
                  <>
                    <span key={token.token_data_id} className="pl-4">
                      TokenID :
                      <code 
                        className="border border-input rounded px-2 py-1"
                        onClick={() => onCopy(token.token_data_id)}>
                        {shorten(token.token_data_id)}
                      </code>
                    </span>
                  </>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

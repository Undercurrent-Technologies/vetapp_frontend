import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserPositions } from "@/hooks/useUserPositions";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "./ui/button";
import { gaugeCommit } from "@/entry-functions/gaugeCommit";

export function UserPositions() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isFetching } = useUserPositions();

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

  const onCommit = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        gaugeCommit({
          poolAddress,
          positionAddress,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["position-commit", account.address] });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to commit position.",
      });
    } finally {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["user-positions", account.address] });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">User positions</h4>
        <div className="text-sm text-muted-foreground">
          Collection address: {data?.collectionAddress ?? "unknown"}
        </div>
      </div>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="text-sm flex flex-col gap-3">
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
                  <PoolTokenRow
                    key={token.token_data_id}
                    token={token}
                    onCopy={onCopy}
                    onCommit={onCommit}
                    poolAddress={group.name}
                    shorten={shorten}
                    isSubmitting={isSubmitting}
                    isWalletReady={Boolean(account)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PoolToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

type PoolTokenRowProps = {
  token: PoolToken;
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function PoolTokenRow({
  token,
  onCopy,
  onCommit,
  poolAddress,
  shorten,
  isSubmitting,
  isWalletReady,
}: PoolTokenRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
  return (
    <span className="pl-4">
      PositionID #{Number.isFinite(positionIdx) ? positionIdx : "unknown"}:<span>  </span>
      <code
        className="border border-input rounded px-2 py-1"
        onClick={() => onCopy(token.token_data_id)}
      >
        {shorten(token.token_data_id)}
      </code>
      <Button
        className="ml-2"
        size="sm"
        disabled={!isWalletReady || isSubmitting}
        onClick={() => onCommit(poolAddress, token.token_data_id)}
      >
        Commit
      </Button>
    </span>
  );
}

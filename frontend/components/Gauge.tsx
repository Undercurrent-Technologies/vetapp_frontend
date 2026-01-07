import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGauge } from "@/hooks/useGauge";
import { GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "@/components/ui/button";
import { gaugeUncommit } from "@/entry-functions/gaugeUncommit";

export function Gauge() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isFetching, isError } = useGauge();
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

  const onUncommit = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        gaugeUncommit({
          poolAddress,
          positionAddress,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["user-positions", "gauge-pools"] });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to uncommit position.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <div className="text-sm text-muted-foreground">VETAPP address not configured.</div>;
  }

  if (isError) {
    return <div className="text-sm text-destructive">Failed to load pools.</div>;
  }

  const isLoading = isFetching;
  const poolList = data?.pools ?? [];
  const poolTokens = data?.poolTokens ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">Gauge pools</h4>
        <div className="text-sm text-muted-foreground">Pools: {poolList.length}</div>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
      {!isLoading && poolList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pools configured.</p>
      ) : null}
      {!isLoading && poolList.length > 0 ? (
        <div className="flex flex-col gap-4">
          {poolList.map((pool) => {
            const poolAddress = `${pool}`;
            const poolKey = poolAddress.toLowerCase();
            const tokens = poolTokens[poolKey] ?? [];

            return (
              <div key={poolKey} className="text-sm flex flex-col gap-2">
                <h3>
                  <span>Pool: </span>
                  <code
                    className="border border-input rounded px-2 py-1"
                    onClick={() => onCopy(poolAddress)}
                  >
                    {shorten(poolAddress)}
                  </code>
                </h3>
                {tokens.length === 0 ? (
                  <p className="text-muted-foreground">No positions for this pool.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tokens.map((token) => (
                      <PoolTokenRow
                        key={token.token_data_id}
                        token={token}
                        onCopy={onCopy}
                        onUncommit={onUncommit}
                        poolAddress={poolAddress}
                        shorten={shorten}
                        isSubmitting={isSubmitting}
                        isWalletReady={Boolean(account)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function PoolTokenRow({
  token,
  onCopy,
  onUncommit,
  poolAddress,
  shorten,
  isSubmitting,
  isWalletReady,
}: PoolTokenRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
  const { data: earnedData, isFetching: earnedFetching } = useQuery({
    queryKey: ["gauge-earned", poolAddress, positionIdx],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS && Number.isFinite(positionIdx)),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::earned`,
          functionArguments: [poolAddress, positionIdx],
        },
      });
      return result[0];
    },
  });
  return (
    <span className="pl-4">
      PositionID #{Number.isFinite(positionIdx) ? positionIdx : "unknown"}:<span>  </span>
      <code
        className="border border-input rounded px-2 py-1"
        onClick={() => onCopy(token.token_data_id)}
      >
        {shorten(token.token_data_id)}
      </code>
      <span className="ml-2">
        Earned:{" "}
        {Number.isFinite(positionIdx)
          ? earnedFetching
            ? "Loading..."
            : `${earnedData ?? 0}`
          : "unknown"}
      </span>
      <Button
        className="ml-2"
        size="sm"
        disabled={!isWalletReady || isSubmitting}
        onClick={() => onUncommit(poolAddress, token.token_data_id)}
      >
        Uncommit
      </Button>
    </span>
  );
}

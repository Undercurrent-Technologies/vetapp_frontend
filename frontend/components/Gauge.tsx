import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGauge } from "@/hooks/useGauge";
import { AMM_ACCOUNT_ADDRESS, GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
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

  const onClaimReward = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting || !positionAddress) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction({
        data: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::claim_rewards`,
          functionArguments: [[poolAddress], [positionAddress]],
        },
      });
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["gauge-earned", poolAddress, positionAddress] });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim reward.",
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
              <div key={poolKey} className="text-xs flex flex-col gap-2">
                <h3>
                  <span>Pool: </span>
                  <code
                    className="border border-input rounded px-2 py-1"
                    onClick={() => onCopy(poolAddress)}
                  >
                    {shorten(poolAddress)}
                  </code>
                  <RewardPerToken poolAddress={poolAddress} />
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
                        onClaimReward={onClaimReward}
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
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

type RewardPerTokenProps = {
  poolAddress: string;
};

function RewardPerToken({ poolAddress }: RewardPerTokenProps) {
  const { data, isFetching } = useQuery({
    queryKey: ["gauge-reward-per-token", poolAddress],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::reward_per_token`,
          functionArguments: [poolAddress],
        },
      });
      return result[0];
    },
  });

  return (
    <span className="ml-2">
      Reward per LP token: {isFetching ? "Loading..." : `${data ?? 0}`}
    </span>
  );
}

function PoolTokenRow({
  token,
  onCopy,
  onUncommit,
  onClaimReward,
  poolAddress,
  shorten,
  isSubmitting,
  isWalletReady,
}: PoolTokenRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
  const positionAddress = token.token_data_id;
  const { data: earnedData, isFetching: earnedFetching } = useQuery({
    queryKey: ["gauge-earned", poolAddress, positionAddress],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS && positionAddress),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::earned`,
          functionArguments: [poolAddress, positionAddress],
        },
      });
      return result[0];
    },
  });
  const canFetchClaimable = Boolean(AMM_ACCOUNT_ADDRESS && Number.isFinite(positionIdx));
  const { data: claimableData, isFetching: claimableFetching } = useQuery({
    queryKey: ["amm-claimable", poolAddress, positionIdx],
    enabled: canFetchClaimable,
    queryFn: async (): Promise<Array<string | number | bigint>> => {
      const result = await aptosClient().view<[Array<string | number | bigint>]>({
        payload: {
          function: `${AMM_ACCOUNT_ADDRESS}::amm::claimable`,
          functionArguments: [poolAddress, positionIdx],
        },
      });
      return result[0] ?? [];
    },
  });
  const claimableDisplay = Array.isArray(claimableData)
    ? `[${claimableData.map((value) => formatNumber8(value)).join(", ")}]`
    : "0";
  return (
    <div className="text pl-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span>PositionID #{positionIdx}</span>
        <code
          className="border border-input rounded px-2 py-1"
          onClick={() => onCopy(token.token_data_id)}
        >
          {shorten(token.token_data_id)}
        </code>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting}
          onClick={() => onUncommit(poolAddress, token.token_data_id)}
        >
          Uncommit
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Earned fees:{" "}
          {canFetchClaimable ? (claimableFetching ? "Loading..." : claimableDisplay) : "unknown"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Earned $TAPP:{" "}
          {positionAddress
            ? earnedFetching
              ? "Loading..."
              : formatNumber8(earnedData ?? 0)
            : "unknown"}
        </span>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting || !positionAddress}
          onClick={() => onClaimReward(poolAddress, positionAddress)}
        >
          Get reward
        </Button>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useLocks } from "@/hooks/useLocks";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

type PoolVotesProps = {
  tokenAddress: string;
  onCopy: (value: string) => void;
  shorten: (value: string) => string;
};

function PoolVotes({ tokenAddress, onCopy, shorten }: PoolVotesProps) {
  const { data, isFetching } = useQuery({
    queryKey: ["pool-votes", tokenAddress],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<{
      voted: boolean;
      pools: { address: string; weight: string | number | bigint }[];
    }> => {
      const [votedResult, poolsResult] = await Promise.all([
        aptosClient().view<[boolean]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::voted`,
            functionArguments: [tokenAddress],
          },
        }),
        aptosClient().view<[string[]]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::voter::pools`,
          },
        }),
      ]);
      const pools = poolsResult[0] ?? [];
      const weights = await Promise.all(
        pools.map((pool) =>
          aptosClient().view<[string | number | bigint]>({
            payload: {
              function: `${VETAPP_ACCOUNT_ADDRESS}::voter::vote_of`,
              functionArguments: [tokenAddress, pool],
            },
          }),
        ),
      );
      const poolsWithWeights = pools.map((pool, index) => ({ address: pool, weight: weights[index][0] }));
      return {
        voted: votedResult[0],
        pools: poolsWithWeights,
      };
    },
  });

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <span className="text-sm text-muted-foreground">VETAPP address not configured.</span>;
  }

  if (isFetching) {
    return <span className="text-sm text-muted-foreground">Loading votes...</span>;
  }

  const voted = data?.voted ?? false;
  const pools = data?.pools ?? [];
  if (pools.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        Voted this epoch: {voted ? "Yes" : "No"} · No voted pools.
      </span>
    );
  }

  return (
    <div className="text-sm flex flex-col gap-1 pl-4">
      <span className={voted ? "text-emerald-600" : "text-red-600"}>{voted ? "Voted" : "Not voted"}</span>
      <ul className="list-disc pl-6">
        {pools.map((pool) => (
          <li key={pool.address}>
            <code className="border border-input rounded px-2 py-1" onClick={() => onCopy(pool.address)}>
              {shorten(pool.address)}
            </code>{" "}
            weight: {`${pool.weight}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UserLocks() {
  const { data, isFetching } = useLocks();

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
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">User locks</h4>
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
            {tokens.map((token) => (
              <div key={token.token_data_id} className="flex flex-col gap-2">
                <span>
                  {token.current_token_data?.token_name} :
                  <code
                    className="border border-input rounded px-2 py-1"
                    onClick={() => onCopy(token.token_data_id)}
                  >
                    {shorten(token.token_data_id)}
                  </code>
                </span>
                <PoolVotes tokenAddress={token.token_data_id} onCopy={onCopy} shorten={shorten} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

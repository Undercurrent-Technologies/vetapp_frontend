import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

type GaugeQueryResult = {
  pools: string[];
};

export function useGauge(enabled = true): UseQueryResult<GaugeQueryResult> {
  return useQuery<GaugeQueryResult>({
    queryKey: ["gauges"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS) && enabled,
    staleTime: 1 * 60 * 1000, // cache for 5 minutes
    queryFn: async (): Promise<GaugeQueryResult> => {
      if (!VETAPP_ACCOUNT_ADDRESS) {
        return { pools: [] };
      }
      const poolsResult = await aptosClient().view<[string[]]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::gauges`,
        },
      });
      const pools = poolsResult[0] ?? [];
      return { pools };
    },
  });
}

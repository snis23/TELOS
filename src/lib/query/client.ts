import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // 연결이 끊기면 저장을 멈춰 두었다가 연결되면 다시 보낸다 (10.1)
        networkMode: "online",
        retry: 1,
      },
    },
  });
}

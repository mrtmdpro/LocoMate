export const CROSSOVER_MATCHING_FLAG = "CROSSOVER_MATCHING_ENABLED";
export const CROSSOVER_PARKED_MESSAGE = "Crossover Matching is parked";

export function isCrossoverMatchingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[CROSSOVER_MATCHING_FLAG] === "true";
}

export function isCrossoverTrpcPath(pathname: string): boolean {
  const prefix = "/api/trpc/";
  if (!pathname.startsWith(prefix)) return false;

  const trpcPath = decodeURIComponent(pathname.slice(prefix.length));
  return trpcPath
    .split(",")
    .some((procedure) => procedure === "crossover" || procedure.startsWith("crossover."));
}

import { db } from "@/server/db";
import { runT36hSweep } from "@/server/services/crossover-cron";
import { runCronSweep } from "../_cron";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronSweep({
    request,
    run: (now) => runT36hSweep(db, now),
    sweep: "crossover-t36",
  });
}

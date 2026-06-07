import { db } from "@/server/db";
import { runT24hSweep } from "@/server/services/crossover-cron";
import { runCronSweep } from "../_cron";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronSweep({
    request,
    run: (now) => runT24hSweep(db, now),
    sweep: "crossover-t24",
  });
}

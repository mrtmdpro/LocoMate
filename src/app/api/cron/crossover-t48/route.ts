import { db } from "@/server/db";
import { runT48hSweep } from "@/server/services/crossover-cron";
import { runCronSweep } from "../_cron";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronSweep({
    request,
    run: (now) => runT48hSweep(db, now),
    sweep: "crossover-t48",
  });
}

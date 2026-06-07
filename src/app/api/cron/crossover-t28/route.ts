import { db } from "@/server/db";
import { runT28hSweep } from "@/server/services/crossover-cron";
import { runCronSweep } from "../_cron";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronSweep({
    request,
    run: (now) => runT28hSweep(db, now),
    sweep: "crossover-t28",
  });
}

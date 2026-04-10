import { router } from "../trpc";
import { authRouter } from "./auth.router";
import { userRouter } from "./user.router";
import { placeRouter } from "./place.router";
import { matchRouter } from "./match.router";
import { chatRouter } from "./chat.router";
import { tourRouter } from "./tour.router";
import { paymentRouter } from "./payment.router";
import { hostRouter } from "./host.router";
import { reviewRouter } from "./review.router";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  place: placeRouter,
  match: matchRouter,
  chat: chatRouter,
  tour: tourRouter,
  payment: paymentRouter,
  host: hostRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;

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
import { experienceRouter } from "./experience.router";
import { fixedTourRouter } from "./fixedTour.router";
import { customizedTourTemplateRouter } from "./customizedTourTemplate.router";
import { crossoverRouter } from "./crossover.router";
import { hostExperienceRouter } from "./host-experience.router";
import { activityRouter } from "./activity.router";
import { cartRouter } from "./cart.router";
import { orderRouter } from "./order.router";
import { merchRouter } from "./merch.router";
import { couponRouter } from "./coupon.router";

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
  experience: experienceRouter,
  fixedTour: fixedTourRouter,
  customizedTourTemplate: customizedTourTemplateRouter,
  crossover: crossoverRouter,
  hostExperience: hostExperienceRouter,
  // Product-pivot routers (Apr 2026): a-la-carte activities, persistent cart,
  // multi-line orders, merch CMS.
  activity: activityRouter,
  cart: cartRouter,
  order: orderRouter,
  merch: merchRouter,
  // Wrap-up coupon: issued by tour.completeTour, validated at /checkout,
  // atomically redeemed inside payment.confirm. See coupon.router.ts.
  coupon: couponRouter,
});

export type AppRouter = typeof appRouter;

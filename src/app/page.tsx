"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth";

export default function SplashPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        router.push(user ? "/home" : "/welcome");
      }, 500);
    }, 1200);
    return () => clearTimeout(timer);
  }, [user, router]);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 flex flex-col items-center justify-center text-white relative overflow-hidden"
      animate={exiting ? { opacity: 0, scale: 1.05 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=800&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 z-0" />
      <motion.div
        className="text-center space-y-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.img
          src="/images/logo.png"
          alt="LOCOMATE"
          className="h-24 mx-auto drop-shadow-lg"
          animate={exiting ? { scale: 1.15 } : { scale: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.p
          className="text-lg opacity-90 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.3 }}
        >
          Go a place, know its grace
        </motion.p>
        <div className="mt-8">
          <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </motion.div>
    </motion.div>
  );
}

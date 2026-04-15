"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const CATEGORIES = ["All", "Culinary", "Cultural", "Adventure", "Nightlife"];

export default function ExperiencesPage() {
  const [category, setCategory] = useState("All");
  const { data: experiences, isLoading } = trpc.experience.list.useQuery(
    category === "All" ? undefined : { category: category.toLowerCase() }
  );

  return (
    <PageTransition>
    <div className="pb-24">
      {/* Hero */}
      <div className="relative h-52 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&h=400&fit=crop"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Badge className="bg-[#ff8c30] border-0 text-white text-[10px] mb-2">ONLY IN HANOI</Badge>
          <h1 className="text-2xl font-bold font-heading text-white leading-tight">
            Experiences You Can&apos;t Book Anywhere Else
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Real moments with real locals. Not tours — stories.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={category === cat ? "default" : "outline"}
              className={`cursor-pointer px-3.5 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
                category === cat ? "bg-[#ff8c30] text-white border-[#ff8c30]" : "bg-white hover:border-[#ff8c30]"
              }`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Experiences List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {experiences?.map((exp, idx) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
              >
                <Link href={`/experiences/${exp.slug}`}>
                  <Card className="border-0 shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-44 relative overflow-hidden">
                      {(exp.photos as string[] | null)?.[0] && (
                        <img src={(exp.photos as string[])[0]} alt={exp.title} className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <Badge className="absolute top-3 left-3 bg-[#3f6f60] border-0 text-white text-[10px] capitalize">{exp.category}</Badge>
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                        <span className="text-yellow-400 text-xs">★</span>
                        <span className="text-white text-xs font-bold">{Number(exp.avgRating || 0).toFixed(1)}</span>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white font-bold text-base">&ldquo;{exp.title}&rdquo;</h3>
                        <p className="text-white/70 text-xs mt-0.5">{exp.subtitle}</p>
                      </div>
                    </div>
                    <CardContent className="p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {Math.round(exp.durationMinutes / 60)}h
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                            Max {exp.maxGroupSize}
                          </span>
                          <span>{exp.totalBookings} booked</span>
                        </div>
                        <p className="text-base font-bold text-[#ff8c30]">
                          {(exp.priceAmount / 1000).toFixed(0)}k <span className="text-[10px] font-normal text-muted-foreground">VND</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
            {experiences?.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🌟</div>
                <p className="text-muted-foreground">No experiences in this category yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </PageTransition>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/page-transition";

const ESIM_PLANS = [
  { name: "Quick Trip", data: "6 GB", days: 7, price: "$5.90", popular: false, url: "https://gohub.com/esim/vietnam?ref=locomate" },
  { name: "Explorer", data: "15 GB", days: 15, price: "$10.90", popular: true, url: "https://gohub.com/esim/vietnam?ref=locomate" },
  { name: "Extended Stay", data: "30 GB", days: 30, price: "$17.90", popular: false, url: "https://gohub.com/esim/vietnam?ref=locomate" },
  { name: "Unlimited", data: "Unlimited", days: 30, price: "$24.90", popular: false, url: "https://gohub.com/esim/vietnam?ref=locomate" },
];

const FAQS = [
  { q: "What is an eSIM?", a: "An eSIM is a digital SIM that lets you activate a mobile data plan without a physical SIM card. Most phones made after 2018 support eSIM." },
  { q: "How do I activate?", a: "After purchase, you'll receive a QR code. Scan it in your phone's settings to activate your Vietnam data plan. Takes about 2 minutes." },
  { q: "Does it work on my phone?", a: "eSIM works on iPhone XS and newer, Samsung Galaxy S20+, Google Pixel 3+ and most modern Android phones. Check gohub.com for the full compatibility list." },
  { q: "When should I activate?", a: "You can purchase anytime and activate when you land in Vietnam. The plan starts counting from the moment you activate." },
];

export default function EsimPage() {
  return (
    <PageTransition>
    <div className="pb-24">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#3f6f60] to-[#2d5a4d] px-6 pt-8 pb-12 text-white">
        <Badge className="bg-white/20 border-0 text-white text-[10px] mb-3">POWERED BY GOHUB</Badge>
        <h1 className="text-3xl font-bold font-heading leading-tight">
          Stay Connected<br />in Vietnam
        </h1>
        <p className="text-white/70 text-sm mt-2">
          Get instant mobile data the moment you land. No SIM swap, no hassle.
        </p>
        <div className="flex gap-4 mt-5">
          {[
            { icon: "⚡", label: "Instant activation" },
            { icon: "📱", label: "No physical SIM" },
            { icon: "✈️", label: "Works on arrival" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5">
              <span className="text-sm">{badge.icon}</span>
              <span className="text-[10px] text-white/80 font-medium">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 -mt-6 space-y-4">
        {/* Plans */}
        <div className="space-y-3">
          {ESIM_PLANS.map((plan) => (
            <a key={plan.name} href={plan.url} target="_blank" rel="noopener noreferrer">
              <Card className={`border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${plan.popular ? "ring-2 ring-[#ff8c30]" : ""}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#D9EDBF]/50 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-[#3f6f60]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#3f6f60]">{plan.name}</h3>
                      {plan.popular && <Badge className="bg-[#ff8c30] border-0 text-white text-[9px]">POPULAR</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.data} &middot; {plan.days} days &middot; Vietnam 4G/5G
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#ff8c30]">{plan.price}</p>
                    <p className="text-[10px] text-muted-foreground">USD</p>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        {/* How it works */}
        <Card className="border-0 bg-[#ff8c30]/5">
          <CardContent className="p-4">
            <h3 className="font-bold text-[#3f6f60] mb-3">How it works</h3>
            <div className="space-y-3">
              {[
                { step: "1", title: "Choose a plan", desc: "Pick the data plan that fits your trip length" },
                { step: "2", title: "Get your QR code", desc: "Delivered to your email instantly after purchase" },
                { step: "3", title: "Scan & connect", desc: "Open your phone settings, scan the QR, and you're online" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#ff8c30] text-white text-xs font-bold flex items-center justify-center shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#3f6f60]">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div>
          <h3 className="font-bold text-[#3f6f60] mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <Card key={faq.q} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold text-[#3f6f60]">{faq.q}</p>
                  <p className="text-xs text-muted-foreground mt-1">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <a href="https://gohub.com/esim/vietnam?ref=locomate" target="_blank" rel="noopener noreferrer">
          <Button className="w-full h-14 rounded-2xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-bold text-base shadow-lg mt-2">
            Browse All Vietnam eSIM Plans
          </Button>
        </a>

        <p className="text-center text-[10px] text-muted-foreground">
          Powered by GoHub. LOCOMATE may earn a commission from purchases made through these links.
        </p>
      </div>
    </div>
    </PageTransition>
  );
}

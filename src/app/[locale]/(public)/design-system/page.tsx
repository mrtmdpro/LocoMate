"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApplicationNote,
  AoDai,
  BrandTag,
  CloudScroll,
  ConicalHat,
  DongSonSun,
  DrumRing,
  EmptyState,
  FeatureCard,
  FolkStar,
  HoiVanBand,
  HoiVanDivider,
  Lotus,
  MamCom,
  PhinFilter,
  RuleNote,
  TourCard,
  Waves,
} from "@/components/brand";

/**
 * /design-system — the in-app showcase of the Locomate brand.
 *
 * Mirrors the canvas at
 * `~/.cursor/projects/c-Dev-locomate/canvases/locomate-design-system.canvas.tsx`,
 * but reuses the actual production brand library so the showcase always
 * matches what ships. If something looks wrong here, it looks wrong on the
 * product surfaces too — fix the brand library, not this page.
 */
export default function DesignSystemPage() {
  return (
    <div className="px-4 lg:px-10 py-10 lg:py-14 max-w-6xl mx-auto space-y-14 lg:space-y-20">
      {/* MASTHEAD */}
      <header className="space-y-7">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Mini design system</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-eyebrow">v1 · 2026</span>
          <span className="text-eyebrow ml-auto hidden sm:inline">For pilot · Hà Nội</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-start">
          <div className="flex flex-col gap-1">
            <span className="text-h1 font-voice text-brick leading-none">Locomate</span>
            <span className="text-h1 font-voice text-primary pl-1.5 font-normal">
              in style.
            </span>
          </div>

          <div className="flex flex-col gap-6 lg:pt-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-eyebrow">Slogan</span>
              <span className="text-h1 font-voice text-foreground font-normal leading-tight">
                Go a place, know its grace.
              </span>
              <span className="font-serif italic text-sm lg:text-base text-muted-foreground">
                Đi cho đúng, gặp cho trúng.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-eyebrow">Tagline</span>
              <span className="font-sans font-semibold text-base text-secondary tracking-tight">
                Your way. Your people.
              </span>
              <span className="font-serif italic text-sm text-muted-foreground">
                Đồng hành cùng bạn, theo cách riêng bạn.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-foreground/12 rounded-lg p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-baseline gap-4 lg:gap-7">
            <div className="flex flex-col gap-1 lg:min-w-[14rem]">
              <span className="text-eyebrow">Positioning</span>
              <span className="text-sm font-semibold text-foreground">
                Standardised, with controlled flex.
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground flex-1">
              AI-personalised travel WebApp. Two product rails: <span className="font-semibold text-brick">Fixed Tours</span> co-designed with locals, and <span className="font-semibold text-secondary">Flexible Tours</span> assembled from tickets, workshops and add-ons. AI is a <em>persuasion layer</em>, not the engine — it explains <em>why</em> a trip fits you. Add-on revenue: merch + integrated eSIM.
            </p>
          </div>
        </div>
      </header>

      <HoiVanDivider />

      {/* COLOR */}
      <section className="space-y-6">
        <SectionHeader
          kicker="01 — Color"
          title="Warm earth, heritage red, sage calm."
          lead="A palette pulled from lacquerware, phin coffee tins, áo dài silk and bánh mì lithographs. Terracotta carries primary actions; forest grounds flexible / advisory surfaces; brick is reserved for moments of heritage and price."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-5">
          <Swatch name="Terracotta" role="Primary action · Fixed Tours · CTAs" hex="#D94A26" large />
          <Swatch name="Brick" role="Heritage · price · serif emphasis" hex="#7A1F18" large />
          <Swatch name="Forest" role="Flexible Tours · trust · system text" hex="#23402B" large />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-5">
          <Swatch name="Mustard" role="Workshops · highlight · ratings" hex="#E9B83C" textColor="#1A1410" />
          <Swatch name="Sage" role="eSIM · soft success · rest states" hex="#A8C589" textColor="#1A1410" />
          <Swatch name="Earth" role="Merch · long-form text accent" hex="#5A3A24" />
        </div>
        <div className="flex flex-wrap gap-3">
          <NeutralChip name="Cream" hex="#F4ECDC" role="Page · canvas wash" textColor="#1A1410" />
          <NeutralChip name="Parchment" hex="#FAF6EC" role="Cards · raised surfaces" textColor="#1A1410" />
          <NeutralChip name="Paper" hex="#FFFBF1" role="Inputs · highest layer" textColor="#1A1410" />
          <NeutralChip name="Ink" hex="#1A1410" role="Body text · 100% / 62% / 38%" textColor="#FAF6EC" />
        </div>
      </section>

      <HoiVanDivider />

      {/* TYPOGRAPHY */}
      <section className="space-y-7">
        <SectionHeader
          kicker="02 — Typography"
          title="Italic serif speaks. Sans does the work."
          lead="Cormorant Garamond italic carries brand voice — wordmarks, hero quotes, prices. Inter handles UI, navigation, and Vietnamese diacritics with ruthless legibility. Mono is reserved for IDs and codes."
        />
        <TypeSpecimen
          label="Display"
          family="font-serif"
          italic
          weightClass="font-normal"
          sizeClass="text-5xl lg:text-6xl leading-tight"
          extraClass="text-brick"
          meta="Cormorant Garamond · italic"
          metricLabel="56–64 / weight 400"
          sample="Đi cho đúng, gặp cho trúng."
        />
        <Hairline />
        <TypeSpecimen
          label="H1"
          family="font-sans"
          weightClass="font-semibold"
          sizeClass="text-3xl lg:text-4xl leading-tight tracking-tight"
          meta="Inter · semibold"
          metricLabel="32–36 / weight 600"
          sample="Build a day that feels like yours."
        />
        <Hairline />
        <TypeSpecimen
          label="H2"
          family="font-sans"
          weightClass="font-semibold"
          sizeClass="text-xl leading-7"
          meta="Inter · semibold"
          metricLabel="20 / weight 600"
          sample="Workshops trong khu phố cổ Hà Nội"
        />
        <Hairline />
        <TypeSpecimen
          label="Body"
          family="font-sans"
          weightClass="font-normal"
          sizeClass="text-base leading-7"
          extraClass="text-muted-foreground"
          meta="Inter · regular"
          metricLabel="15–17 / weight 400"
          sample="Locomate ghép bạn với một hành trình thật sự hợp gu, được local guide đồng thiết kế. Bạn chọn nhịp; chúng tôi xếp đúng người, đúng chỗ, đúng giờ."
        />
        <Hairline />
        <TypeSpecimen
          label="Caption"
          family="font-mono"
          weightClass="font-medium"
          sizeClass="text-xs leading-4 tracking-[0.18em] uppercase"
          extraClass="text-muted-foreground"
          meta="Mono · uppercase"
          metricLabel="12 / weight 500"
          sample="FROM 480K VND · 3.5 HOURS · GROUP ≤ 8"
        />
      </section>

      <HoiVanDivider />

      {/* ILLUSTRATION & PATTERNS */}
      <section className="space-y-7">
        <SectionHeader
          kicker="03 — Illustration & patterns"
          title="Drawn from drum, lacquer and lithograph."
          lead="Hand-pulled motifs from the Đông Sơn bronze drum (~2nd c. BCE), imperial Nguyễn cloud robes, ceramic hồi-văn key borders, and the conical-hat lithography of Indochine-era posters. Single-weight ink. No shading. No perspective."
        />

        <div className="space-y-4">
          <SubHeader label="Patterns · structural / repeatable" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <PatternTile name="Đông Sơn" subtitle="Sun centre · bronze drum">
              <DongSonSun size={92} />
            </PatternTile>
            <PatternTile name="Trống đồng" subtitle="Concentric drum band">
              <DrumRing size={92} />
            </PatternTile>
            <PatternTile name="Hồi văn" subtitle="Key border · ceramic">
              <HoiVanBand width={150} height={56} />
            </PatternTile>
            <PatternTile name="Sóng nước" subtitle="Imperial wave · Nguyễn">
              <Waves width={150} height={56} />
            </PatternTile>
          </div>
        </div>

        <div className="space-y-4">
          <SubHeader label="Illustrations · figurative spots" />
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            <IllusTile name="Mâm cơm"><MamCom size={64} /></IllusTile>
            <IllusTile name="Sen"><Lotus size={64} /></IllusTile>
            <IllusTile name="Nón lá"><ConicalHat size={64} /></IllusTile>
            <IllusTile name="Phin"><PhinFilter size={64} /></IllusTile>
            <IllusTile name="Áo dài"><AoDai size={64} /></IllusTile>
            <IllusTile name="Folk star"><FolkStar size={64} /></IllusTile>
          </div>
        </div>

        <div className="bg-card border border-foreground/12 rounded-lg p-5 lg:p-6">
          <div className="flex flex-col gap-4">
            <span className="text-eyebrow">Style rules</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <RuleNote n="01" title="One ink weight">
                1.3 px lines for figures. 1.5 px for pattern bands. No tapered or calligraphic strokes.
              </RuleNote>
              <RuleNote n="02" title="Brick or forest only">
                All linework is brick or forest. Mustard / sage may fill, never stroke. Terracotta is reserved for the folk-star emblem.
              </RuleNote>
              <RuleNote n="03" title="Flat, never plastic">
                Top-down or pure side. No shading. No drop-shadow. Halftone OK at 0.8 px.
              </RuleNote>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="space-y-6">
        <SectionHeader
          kicker="04 — Feature highlights"
          title="Six features. Six motifs. One voice."
          lead="Every product surface pairs a quiet hand-drawn motif with one italic title and one specific sentence."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            accent="brick"
            illus={<DongSonSun size={64} />}
            kicker="AI Match"
            title="Why this trip is for you."
            body="Not a black-box recommender. A brief, plainspoken explanation of fit — pacing, tastes, language, distance — written in the guide's own voice."
            tags={[{ tone: "ai", label: "AI · Explainable" }]}
          />
          <FeatureCard
            accent="terracotta"
            illus={<MamCom size={64} />}
            kicker="Fixed Tours"
            title="Co-designed, ready to go."
            body="A standardised arc: 1 attraction + 1–2 small workshops + 1 local meal."
            tags={[
              { tone: "fixed", label: "Fixed" },
              { tone: "guide", label: "+ Guide" },
            ]}
          />
          <FeatureCard
            accent="forest"
            illus={<Lotus size={64} color="var(--secondary)" />}
            kicker="Flexible Tours"
            title="Build your day, conflict-free."
            body="Pick attractions and workshops on a shared timeline. Logic catches schedule clashes for you."
            tags={[
              { tone: "flexible", label: "Flexible" },
              { tone: "workshop", label: "Workshop" },
            ]}
          />
          <FeatureCard
            accent="brick"
            illus={<ConicalHat size={64} />}
            kicker="Local Guides"
            title="Paired by personality."
            body="Not just availability. We surface 1–2 guides who actually love what you've built."
            tags={[{ tone: "guide", label: "+ Guide" }]}
          />
          <FeatureCard
            accent="forest"
            illus={<Waves width={120} height={64} color="var(--secondary)" opacity={0.85} />}
            kicker="eSIM"
            title="Connected the moment you land."
            body="Bundled into your itinerary. Activates on landing, scoped to your tour days."
            tags={[{ tone: "esim", label: "eSIM 1GB / day" }]}
          />
          <FeatureCard
            accent="terracotta"
            illus={<FolkStar size={64} />}
            kicker="Merch"
            title="Take a slice of place home."
            body="A short shelf of locally-designed pieces — áo, mũ, ceramic — discounted only for tour guests."
            tags={[{ tone: "merch", label: "Merch" }]}
          />
        </div>
      </section>

      <HoiVanDivider />

      {/* COMPONENTS */}
      <section className="space-y-6">
        <SectionHeader
          kicker="05 — Components"
          title="Soft pills, pill-shaped buttons, hairline cards."
          lead="Everything sits on cream. Buttons are full-radius pills. Tags carry tone; cards stay quiet so content can sing."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <span className="text-eyebrow">Buttons</span>
              <div className="flex flex-wrap gap-2.5">
                <Button variant="default" size="brand">Reserve a seat</Button>
                <Button variant="forest" size="brand">Configure trip</Button>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Button variant="secondary" size="brand">Save for later</Button>
                <Button variant="link" size="brand">View itinerary</Button>
              </div>
              <div className="space-y-1">
                <span className="text-eyebrow">Rules</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  One <span className="font-semibold text-brick">terracotta</span> primary per surface. Use <span className="font-semibold text-secondary">forest</span> for the flexible-tour configure flow. Ghost links carry an underline at 4px offset.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <span className="text-eyebrow">Tags · Categories</span>
              <div className="flex flex-wrap gap-1.5">
                <BrandTag tone="fixed">Fixed tour</BrandTag>
                <BrandTag tone="flexible">Flexible tour</BrandTag>
                <BrandTag tone="workshop">Workshop</BrandTag>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <BrandTag tone="esim">eSIM</BrandTag>
                <BrandTag tone="merch">Merch</BrandTag>
                <BrandTag tone="guide">+ Guide</BrandTag>
                <BrandTag tone="ai">AI match · 92%</BrandTag>
              </div>
              <div className="space-y-1">
                <span className="text-eyebrow">Rules</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each rail and add-on owns one tone. Stack max <span className="font-semibold">3 tags</span> on a card. The AI tag is always <span className="font-semibold">ink-on-cream</span> — a label, not a category.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-eyebrow">Form input · single line</span>
              <span className="text-eyebrow text-muted-foreground/80">36 px height · 1 px ink hairline · 6 px radius</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FieldDemo label="Search">
                <Input placeholder="Phố cổ, ẩm thực, làng nghề…" />
              </FieldDemo>
              <FieldDemo label="Date">
                <Input placeholder="Sat 09 May" />
              </FieldDemo>
              <FieldDemo label="Guests">
                <Input placeholder="2 adults" />
              </FieldDemo>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* TOUR RAILS */}
      <section className="space-y-6">
        <SectionHeader
          kicker="06 — Tour rails"
          title="Two rails, one visual language."
          lead="Both card types share structure: tone-band, tags, italic title, price block, hairline divider, meta or add-ons, action row. The colour of the band tells the user which rail they're on."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TourCard
            variant="fixed"
            tags={[
              { tone: "fixed", label: "Fixed Tour" },
              { tone: "guide", label: "+ Local guide" },
            ]}
            title="Old Quarter Heritage Walk"
            subtitle="with Linh — designer, third-generation Hà Nội guide"
            price="480k"
            priceCaption="VND / guest · co-designed price"
            meta={[
              { label: "Length", value: "3.5h" },
              { label: "Format", value: "Walking" },
              { label: "Group", value: "≤ 8" },
              { label: "Locale", value: "EN / VI" },
            ]}
            primaryAction={{ label: "Reserve a seat" }}
            secondaryAction={{ label: "View itinerary" }}
          />
          <TourCard
            variant="flexible"
            tags={[
              { tone: "flexible", label: "Flexible Tour" },
              { tone: "ai", label: "AI match · 92%" },
            ]}
            title="Build your day in Huế"
            subtitle="Pick attractions and workshops on a timeline. Logic catches schedule clashes for you."
            price="220k → 1.2M"
            priceCaption="VND · scales with your picks"
            primaryAction={{ label: "Configure trip" }}
            secondaryAction={{ label: "See conflict logic" }}
          />
        </div>
      </section>

      <HoiVanDivider />

      {/* SCALES */}
      <section className="space-y-6">
        <SectionHeader
          kicker="07 — Scales"
          title="Spacing, radius, hairlines."
          lead="A 4-step radius and a 5-step spacing scale cover ~95% of layouts. Hairlines are always solid ink at 10–20% — never colour, never shadow."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-3.5">
            <span className="text-eyebrow">Spacing</span>
            <div className="flex flex-wrap gap-5 items-end">
              <ScalePeg name="xs" value="8 px"><div className="w-2 h-8 bg-foreground" /></ScalePeg>
              <ScalePeg name="sm" value="12 px"><div className="w-3 h-8 bg-foreground" /></ScalePeg>
              <ScalePeg name="md" value="20 px"><div className="w-5 h-8 bg-foreground" /></ScalePeg>
              <ScalePeg name="lg" value="32 px"><div className="w-8 h-8 bg-foreground" /></ScalePeg>
              <ScalePeg name="xl" value="56 px"><div className="w-14 h-8 bg-foreground" /></ScalePeg>
            </div>
          </div>
          <div className="space-y-3.5">
            <span className="text-eyebrow">Radius</span>
            <div className="flex flex-wrap gap-5 items-end">
              <ScalePeg name="card" value="8 px"><div className="w-9 h-9 bg-card border-[1.5px] border-foreground rounded-lg" /></ScalePeg>
              <ScalePeg name="input" value="6 px"><div className="w-9 h-9 bg-card border-[1.5px] border-foreground rounded-md" /></ScalePeg>
              <ScalePeg name="tag · pill" value="999"><div className="w-9 h-9 bg-card border-[1.5px] border-foreground rounded-full" /></ScalePeg>
              <ScalePeg name="band" value="2 px"><div className="w-9 h-9 bg-primary rounded-[2px]" /></ScalePeg>
            </div>
          </div>
        </div>
      </section>

      <HoiVanDivider />

      {/* VOICE & COMPOSITION */}
      <section className="space-y-6">
        <SectionHeader
          kicker="08 — Voice & composition"
          title="What we sound like; how it all stacks."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-secondary text-secondary-foreground rounded-lg p-6 space-y-3.5">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-secondary-foreground/55">Voice</span>
            <div className="space-y-2.5">
              <VoiceLine yes>Quiet confidence — &ldquo;We&apos;ve already paired you. Open it.&rdquo;</VoiceLine>
              <VoiceLine yes>Bilingual without performance — “Cùng đi. Same way.”</VoiceLine>
              <VoiceLine yes>Specific over generic — “3.5h walking, ≤ 8 guests.”</VoiceLine>
              <VoiceLine>Hype and exclamation marks. Marketing voice.</VoiceLine>
              <VoiceLine>Generic AI talk — “our intelligent algorithm…”</VoiceLine>
            </div>
          </div>

          <EmptyState
            illus={<DongSonSun size={180} />}
            eyebrow="No trips yet"
            title="The match is ready when you are."
            body="Tell us where you're going and what you're tired of. We'll come back with one Fixed and one Flexible idea, both already explained."
            actions={
              <>
                <Button variant="default" size="brand">Start a trip</Button>
                <Button variant="link" size="brand">Browse Hà Nội first</Button>
              </>
            }
          />
        </div>

        <Card>
          <CardContent className="space-y-3.5 p-6">
            <span className="text-eyebrow">Application · where motifs go</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ApplicationNote
                illus={<Lotus size={48} color="var(--secondary)" />}
                title="As watermark"
                body="One motif at 12–18% opacity in the corner of empty states, receipts, and confirmations. Never behind body text."
              />
              <ApplicationNote
                illus={<HoiVanBand width={120} height={24} opacity={0.7} />}
                title="As edge band"
                body="A 20-px hồi-văn band closes long surfaces — receipts, emails, the bottom of confirmation screens. Acts like a stamp."
              />
              <ApplicationNote
                illus={<FolkStar size={48} />}
                title="As emblem"
                body="The folk star earns badges only — completed tours, verified guides, anniversary merch. Never decorative."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <CloudScroll size={64} />
            <div className="flex-1">
              <span className="text-eyebrow">Cloud scroll · supplemental</span>
              <p className="text-sm text-foreground/85 mt-1">
                Triện-văn cloud scrolls show up in confirmation states and receipts. Use sparingly — if everything has a flourish, nothing does.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <HoiVanDivider />

      <footer className="flex flex-wrap gap-3 pt-2">
        <span className="text-eyebrow">Locomate · Mini design system</span>
        <span className="text-eyebrow text-muted-foreground/80">
          Drawn from Bộ Nhận Diện moodboard
        </span>
        <span className="text-eyebrow ml-auto">v1 · May 2026</span>
      </footer>
    </div>
  );
}

/* ─── Local helpers ────────────────────────────────────────────────────── */

function SectionHeader({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="flex flex-col gap-2 max-w-3xl">
      <span className="text-eyebrow">{kicker}</span>
      <h2 className="text-h1 font-voice text-foreground font-normal leading-tight">
        {title}
      </h2>
      {lead && <p className="text-sm lg:text-base leading-relaxed text-muted-foreground">{lead}</p>}
    </div>
  );
}

function SubHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-eyebrow">{label}</span>
      <span className="flex-1 h-px bg-foreground/12" />
    </div>
  );
}

function Hairline() {
  return <span className="block h-px bg-foreground/10" />;
}

function Swatch({
  name,
  role,
  hex,
  textColor,
  large,
}: {
  name: string;
  role: string;
  hex: string;
  textColor?: string;
  large?: boolean;
}) {
  const fg = textColor ?? "#FAF6EC";
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`rounded-md border border-foreground/12 p-3.5 flex items-end justify-between ${
          large ? "h-32" : "h-24"
        }`}
        style={{ background: hex }}
      >
        <span
          className="font-mono text-xs uppercase tracking-[0.16em]"
          style={{ color: fg, opacity: 0.85 }}
        >
          {hex.toUpperCase()}
        </span>
        <span
          className="text-h3 font-voice"
          style={{ color: fg, opacity: 0.92 }}
        >
          Aa
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{role}</span>
      </div>
    </div>
  );
}

function NeutralChip({
  name,
  hex,
  role,
  textColor,
}: {
  name: string;
  hex: string;
  role: string;
  textColor: string;
}) {
  return (
    <div
      className="flex flex-1 min-w-[12rem] items-center gap-3 rounded-md border border-foreground/12 px-4 py-3"
      style={{ background: hex, color: textColor }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-xs opacity-70">{role}</span>
      </div>
      <span className="font-mono text-xs ml-auto opacity-80">{hex.toUpperCase()}</span>
    </div>
  );
}

function TypeSpecimen({
  label,
  family,
  italic,
  weightClass,
  sizeClass,
  extraClass,
  meta,
  metricLabel,
  sample,
}: {
  label: string;
  family: string;
  italic?: boolean;
  weightClass: string;
  sizeClass: string;
  extraClass?: string;
  meta: string;
  metricLabel: string;
  sample: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="text-eyebrow min-w-[5rem]">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{metricLabel}</span>
        <span className="font-mono text-xs text-muted-foreground/80 ml-auto">{meta}</span>
      </div>
      <p className={`${family} ${italic ? "italic" : ""} ${weightClass} ${sizeClass} ${extraClass ?? "text-foreground"}`}>
        {sample}
      </p>
    </div>
  );
}

function PatternTile({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="bg-card border border-foreground/12 rounded-md h-28 flex items-center justify-center overflow-hidden p-3">
        {children}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}

function IllusTile({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-paper border border-foreground/12 rounded-md h-24 w-full flex items-center justify-center">
        {children}
      </div>
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{name}</span>
    </div>
  );
}

function FieldDemo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="text-eyebrow">{label}</span>
      {children}
    </div>
  );
}

function ScalePeg({
  name,
  value,
  children,
}: {
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-end h-9">{children}</div>
      <div className="flex flex-col gap-0">
        <span className="text-xs font-semibold text-foreground">{name}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function VoiceLine({ children, yes }: { children: React.ReactNode; yes?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`font-mono text-xs uppercase tracking-[0.16em] min-w-7 pt-0.5 ${
          yes ? "text-sage" : "text-mustard"
        }`}
      >
        {yes ? "do" : "don\u2019t"}
      </span>
      <span
        className={`text-sm leading-snug ${
          yes
            ? "font-serif italic text-base text-secondary-foreground"
            : "text-secondary-foreground/55 line-through decoration-secondary-foreground/40"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

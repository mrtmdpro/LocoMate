"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

/**
 * Platform admin-only CMS for merch products + variants. Accessed from
 * `/admin/products`; access controlled server-side via `adminProcedure`
 * (non-admin callers get FORBIDDEN from tRPC, and we gate the UI here too
 * so non-admins see a friendly message instead of a broken page).
 */
export default function AdminProductsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.merch.adminListAll.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingVariantsFor, setManagingVariantsFor] = useState<string | null>(null);

  const createProduct = trpc.merch.createProduct.useMutation({
    onSuccess: () => {
      toast.success("Product created");
      setCreating(false);
      utils.merch.adminListAll.invalidate();
      utils.merch.list.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Could not create"),
  });

  const updateProduct = trpc.merch.updateProduct.useMutation({
    onSuccess: () => {
      toast.success("Updated");
      setEditingId(null);
      utils.merch.adminListAll.invalidate();
      utils.merch.list.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Could not update"),
  });

  const archiveProduct = trpc.merch.archiveProduct.useMutation({
    onSuccess: () => {
      toast.success("Archived");
      utils.merch.adminListAll.invalidate();
      utils.merch.list.invalidate();
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center space-y-3 pb-24">
        <div className="text-4xl">🔒</div>
        <p className="text-base font-semibold text-secondary">Admin access required</p>
        <p className="text-sm text-muted-foreground">Merch management is reserved for platform admins.</p>
        <Link href="/home" className="text-primary text-sm font-semibold">Back to home</Link>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">Products</h1>
            <p className="text-sm text-muted-foreground">Manage the LOCOMATE merch catalogue.</p>
          </div>
          <Button
            onClick={() => setCreating(!creating)}
            className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-4 h-10"
          >
            {creating ? "Cancel" : "New"}
          </Button>
        </div>

        {creating && <CreateProductForm onSubmit={(data) => createProduct.mutate(data)} pending={createProduct.isPending} />}

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : !products || products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No products yet. Click New to create one.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <Card key={p.id} className="border-0 shadow-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-card rounded-lg shrink-0 overflow-hidden">
                      {p.photos?.[0] && <img src={p.photos[0]} alt={p.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm lg:text-base font-semibold text-secondary line-clamp-1">{p.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">{p.category} · {p.sku}</p>
                      <p className="text-sm text-primary font-bold mt-0.5 tabular-nums">{formatVnd(p.basePriceVnd)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {p.isActive ? (
                        <Badge className="bg-sage text-earth border-0 text-xs">Active</Badge>
                      ) : (
                        <Badge className="bg-muted text-foreground/80 border-0 text-xs">Archived</Badge>
                      )}
                      {p.bundleDiscountPct ? (
                        <Badge className="bg-primary/20 text-primary border-0 text-xs">−{p.bundleDiscountPct}%</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} className="text-secondary font-semibold underline-offset-4 hover:underline">
                      {editingId === p.id ? "Close" : "Edit"}
                    </button>
                    <button onClick={() => setManagingVariantsFor(managingVariantsFor === p.id ? null : p.id)} className="text-secondary font-semibold underline-offset-4 hover:underline">
                      {managingVariantsFor === p.id ? "Close variants" : "Variants"}
                    </button>
                    {p.isActive && (
                      <button onClick={() => archiveProduct.mutate({ id: p.id })} className="text-red-700 font-semibold underline-offset-4 hover:underline">
                        Archive
                      </button>
                    )}
                  </div>
                  {editingId === p.id && <EditProductForm product={p} onSubmit={(patch) => updateProduct.mutate({ id: p.id, patch })} pending={updateProduct.isPending} />}
                  {managingVariantsFor === p.id && <VariantManager productId={p.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function CreateProductForm({ onSubmit, pending }: { onSubmit: (data: {
  sku: string;
  title: string;
  subtitle?: string;
  category: string;
  basePriceVnd: number;
  bundleDiscountPct: number;
  photos: string[];
}) => void; pending: boolean }) {
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("apparel");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [photo, setPhoto] = useState("");

  return (
    <Card className="border-2 border-secondary/20 shadow-sm">
      <CardContent className="p-4 space-y-2">
        <p className="text-base lg:text-lg font-semibold text-secondary">New product</p>
        <Input placeholder="SKU (e.g. LCM-TEE-NEW)" value={sku} onChange={(e) => setSku(e.target.value)} className="h-10" />
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
        <Input placeholder="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="h-10" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 px-3 rounded-md border border-border text-sm">
          <option value="apparel">Apparel</option>
          <option value="accessory">Accessory</option>
          <option value="souvenir">Souvenir</option>
          <option value="print">Print</option>
          <option value="bundle">Bundle</option>
        </select>
        <Input placeholder="Base price (VND, integer)" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="h-10" />
        <Input placeholder="Bundle discount % (0-50)" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="numeric" className="h-10" />
        <Input placeholder="Photo URL (https://…)" value={photo} onChange={(e) => setPhoto(e.target.value)} className="h-10" />
        <Button
          onClick={() => {
            const priceN = Number(price);
            const discountN = Number(discount);
            if (!sku || sku.length < 3) return toast.error("SKU is required");
            if (!title || title.length < 2) return toast.error("Title is required");
            if (!Number.isFinite(priceN) || priceN <= 0) return toast.error("Valid price required");
            onSubmit({
              sku,
              title,
              subtitle: subtitle || undefined,
              category,
              basePriceVnd: priceN,
              bundleDiscountPct: Number.isFinite(discountN) ? Math.max(0, Math.min(50, Math.floor(discountN))) : 0,
              photos: photo ? [photo] : [],
            });
          }}
          disabled={pending}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl h-11 text-sm font-semibold"
        >
          {pending ? "Creating..." : "Create product"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EditProductForm({
  product,
  onSubmit,
  pending,
}: {
  product: { title: string; subtitle: string | null; basePriceVnd: number; bundleDiscountPct: number | null; photos: string[] | null };
  onSubmit: (patch: { title?: string; subtitle?: string; basePriceVnd?: number; bundleDiscountPct?: number; photos?: string[] }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(product.title);
  const [subtitle, setSubtitle] = useState(product.subtitle ?? "");
  const [price, setPrice] = useState(String(product.basePriceVnd));
  const [discount, setDiscount] = useState(String(product.bundleDiscountPct ?? 0));
  const [photo, setPhoto] = useState(product.photos?.[0] ?? "");

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 text-sm" />
      <Input placeholder="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="h-10 text-sm" />
      <Input placeholder="Base price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="h-10 text-sm" />
      <Input placeholder="Bundle discount %" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="numeric" className="h-10 text-sm" />
      <Input placeholder="Photo URL" value={photo} onChange={(e) => setPhoto(e.target.value)} className="h-10 text-sm" />
      <Button
        onClick={() => {
          const priceN = Number(price);
          const discountN = Number(discount);
          onSubmit({
            title,
            subtitle: subtitle || undefined,
            basePriceVnd: Number.isFinite(priceN) && priceN > 0 ? priceN : undefined,
            bundleDiscountPct: Number.isFinite(discountN) ? Math.max(0, Math.min(50, Math.floor(discountN))) : undefined,
            photos: photo ? [photo] : undefined,
          });
        }}
        disabled={pending}
        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl h-10 text-sm font-semibold"
      >
        Save
      </Button>
    </div>
  );
}

function VariantManager({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  // MVP: this surface only lets admins ADD variants. Listing + editing
  // existing variants for an arbitrary product requires an adminListVariants
  // endpoint which we'll add when a real admin needs to correct stock counts
  // in bulk; for now the seed handles initial inventory.
  const [sku, setSku] = useState("");
  const [label, setLabel] = useState("");
  const [stock, setStock] = useState("0");

  const addVariant = trpc.merch.addVariant.useMutation({
    onSuccess: () => {
      toast.success("Variant added");
      setSku(""); setLabel(""); setStock("0");
      utils.merch.adminListAll.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Could not add variant"),
  });

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <p className="text-sm font-medium text-foreground/80">Add variant</p>
      <Input placeholder="Variant SKU" value={sku} onChange={(e) => setSku(e.target.value)} className="h-10 text-sm" />
      <Input placeholder="Label (e.g. M / Black)" value={label} onChange={(e) => setLabel(e.target.value)} className="h-10 text-sm" />
      <Input placeholder="Stock qty" value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className="h-10 text-sm" />
      <Button
        onClick={() => {
          const stockN = Number(stock);
          if (!sku || !label) return toast.error("SKU + label required");
          addVariant.mutate({
            productId,
            sku,
            label,
            stockQuantity: Number.isFinite(stockN) ? Math.max(0, Math.floor(stockN)) : 0,
          });
        }}
        disabled={addVariant.isPending}
        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl h-10 text-sm font-semibold"
      >
        Add variant
      </Button>
    </div>
  );
}

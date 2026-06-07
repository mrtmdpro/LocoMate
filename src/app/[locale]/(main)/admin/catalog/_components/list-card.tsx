import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ListCard({
  rows,
  title,
}: {
  rows: Array<{
    id: string;
    isActive?: boolean | null;
    label: string;
    meta: string;
    onEdit: () => void;
  }>;
  title: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <h2 className="font-semibold text-secondary">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows yet.</p>
        ) : (
          rows.map((row) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"
              key={row.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  {typeof row.isActive === "boolean" ? (
                    <Badge variant={row.isActive ? "guide" : "outline"}>
                      {row.isActive ? "Active" : "Draft"}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              </div>
              <Button size="sm" variant="outline" onClick={row.onEdit}>
                Edit
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

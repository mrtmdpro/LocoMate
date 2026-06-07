import { Card, CardContent } from "@/components/ui/card";

export function AdminOnly() {
  return (
    <div className="p-4 lg:p-8">
      <Card className="border-dashed shadow-none">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Admin access required.
        </CardContent>
      </Card>
    </div>
  );
}

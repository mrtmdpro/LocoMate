import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-gray-200/70", className)}
      {...props}
    />
  );
}

function PageSkeleton({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("p-4 space-y-4", className)}>
      {children || (
        <>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </>
      )}
    </div>
  );
}

export { Skeleton, PageSkeleton };

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className="skeleton h-[26px] w-[26px] shrink-0 rounded-md" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
      <div className="skeleton h-8 w-full rounded" />
      <div className="skeleton h-4 w-2/3 rounded" />
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
        <div className="skeleton h-3 w-14 rounded" />
        <div className="skeleton h-3 w-8 rounded" />
      </div>
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4">
      <div className="skeleton h-11 w-11 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

export default function MarketsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    </div>
  );
}

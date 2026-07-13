export default function MarketListLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-5 w-96 bg-muted rounded animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

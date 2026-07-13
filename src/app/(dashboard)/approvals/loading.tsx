export default function ApprovalsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-5 w-72 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

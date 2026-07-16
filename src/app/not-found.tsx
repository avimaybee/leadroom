import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-heading-2xl">Page Not Found</h2>
      <p className="text-copy-14 text-muted-foreground">The page you are looking for does not exist.</p>
      <Link href="/" className="text-primary hover:underline">Go Home</Link>
    </div>
  );
}

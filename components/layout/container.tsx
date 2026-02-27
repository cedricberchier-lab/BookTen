export function Container({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-20">
      {children}
    </main>
  );
}

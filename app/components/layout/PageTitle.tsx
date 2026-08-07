interface Props {
  title: string;
  description?: string;
}

export default function PageTitle({
  title,
  description,
}: Props) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        {title}
      </h1>

      {description && (
        <p className="mt-1 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
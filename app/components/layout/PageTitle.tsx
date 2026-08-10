interface Props {
  title: string;
  subtitle?: string;
  description?: string;
}

export default function PageTitle({
  title,
  subtitle,
  description,
}: Props) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        {title}
      </h1>

      {subtitle ? (
        <p className="mt-1 text-muted-foreground">
          {subtitle}
        </p>
      ) : description && (
        <p className="mt-1 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
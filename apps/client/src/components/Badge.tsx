interface BadgeProps {
  content: string | number;
  id?: string;
  className?: string;
}

export function Badge({ content, id, className = "" }: BadgeProps) {
  return (
    <span id={id} className={`badge ${className}`}>
      {content}
    </span>
  );
}

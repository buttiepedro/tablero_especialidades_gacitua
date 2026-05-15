import LogoutButton from "@/components/LogoutButton";

interface Props {
  title: string;
}

export default function PageHeader({ title }: Props) {
  return (
    <div className="page-header">
      <div className="header-left">
        <span className="brand-label">Gacitua Bot</span>
        <h1 className="page-title">{title}</h1>
      </div>
      <LogoutButton />
    </div>
  );
}

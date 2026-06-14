interface AvatarOption {
  id: string;
  name: string;
  img: string;
}

export function AvatarPicker({ avatars, selected, onSelect }: {
  avatars: AvatarOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="avatar-picker">
      {avatars.map(avatar => (
        <button
          key={avatar.id}
          type="button"
          aria-pressed={selected === avatar.id}
          className={`avatar-option ${selected === avatar.id ? 'selected' : ''}`}
          onClick={() => onSelect(avatar.id)}
        >
          <img src={avatar.img} alt={avatar.name} />
        </button>
      ))}
    </div>
  );
}

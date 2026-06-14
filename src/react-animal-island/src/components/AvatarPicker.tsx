import { Button } from 'animal-island-ui';

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
        <Button
          key={avatar.id}
          type={selected === avatar.id ? 'primary' : 'default'}
          onClick={() => onSelect(avatar.id)}
          aria-label={avatar.name}
        >
          <img src={avatar.img} alt={avatar.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        </Button>
      ))}
    </div>
  );
}

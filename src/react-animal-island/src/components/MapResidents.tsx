import { AVATARS } from '../domain/config';

interface Resident {
  name: string;
  avatar?: string;
  x: number;
  y: number;
}

export function MapResidents({ residents }: { residents: Resident[] }) {
  if (!residents.length) return null;
  return (
    <>
      {residents.map(resident => {
        const avatar = AVATARS.find(item => item.id === resident.avatar) || AVATARS[0];
        return (
          <div key={resident.name} className="map-resident" data-testid="map-resident" style={{ left: `${resident.x}%`, top: `${resident.y}%` }}>
            <img className="resident-avatar" src={avatar.img} alt={resident.name} />
            <span className="resident-name">{resident.name}</span>
          </div>
        );
      })}
    </>
  );
}

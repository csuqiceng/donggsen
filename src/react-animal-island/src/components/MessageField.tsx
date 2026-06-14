export function MessageField({ value, onChange, onSubmit, maxLength = 20 }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="message-field">
      <input
        className="message-field-input"
        value={value}
        maxLength={maxLength}
        placeholder="留一句岛民留言"
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') onSubmit(value); }}
      />
      <button type="button" className="message-field-submit" onClick={() => onSubmit(value)}>保存留言</button>
    </div>
  );
}

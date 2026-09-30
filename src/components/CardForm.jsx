// Card detail form, used by the evaluator (edit mode) and the collection
// (edit sheet). `sections` picks which groups to render.
import { Field, Input, Toggle } from './ui.jsx';
import { PhotoSlot } from './PhotoPicker.jsx';
import { SPORTS, GRADERS, GRADES, RAW_CONDITIONS } from '../lib/cardText.js';

const SectionTitle = ({ children }) => (
  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dim">{children}</h3>
);

const selCls =
  'h-11 w-full rounded-xl border border-line bg-panel2 px-3 text-base text-white outline-none focus:border-brand';

function Select({ value, onChange, options, placeholder, ariaLabel }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={selCls} aria-label={ariaLabel || placeholder}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function CardForm({ card, onChange, sections = ['photos', 'identity', 'attributes', 'grading'] }) {
  const set = (k) => (v) => onChange({ [k]: v });
  const has = (s) => sections.includes(s);

  return (
    <div className="space-y-6">
      {has('photos') && (
        <div>
          <SectionTitle>Photos</SectionTitle>
          <div className="flex gap-3">
            <PhotoSlot
              label="Front"
              src={card.frontImage}
              onChange={(p) => onChange({ frontImage: p.full, thumb: p.thumb })}
            />
            <PhotoSlot label="Back" src={card.backImage} onChange={(p) => onChange({ backImage: p.full })} />
          </div>
        </div>
      )}

      {has('identity') && (
        <div>
          <SectionTitle>Card identity</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Player" className="col-span-2">
              <Input value={card.player || ''} onChange={(e) => set('player')(e.target.value)} placeholder="e.g. Luka Doncic" />
            </Field>
            <Field label="Year">
              <Input value={card.year || ''} onChange={(e) => set('year')(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="2018" />
            </Field>
            <Field label="Card #">
              <Input value={card.cardNumber || ''} onChange={(e) => set('cardNumber')(e.target.value)} placeholder="280" />
            </Field>
            <Field label="Set" className="col-span-2">
              <Input value={card.set || ''} onChange={(e) => set('set')(e.target.value)} placeholder="e.g. Panini Prizm" />
            </Field>
            <Field label="Team">
              <Input value={card.team || ''} onChange={(e) => set('team')(e.target.value)} placeholder="e.g. Mavericks" />
            </Field>
            <Field label="Sport">
              <Select value={card.sport} onChange={set('sport')} options={SPORTS} placeholder="Select…" ariaLabel="Sport" />
            </Field>
            <Field label="Parallel / variety" className="col-span-2">
              <Input value={card.parallel || ''} onChange={(e) => set('parallel')(e.target.value)} placeholder="e.g. Silver Prizm" />
            </Field>
          </div>
        </div>
      )}

      {has('attributes') && (
        <div>
          <SectionTitle>Attributes</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Toggle label="Rookie" checked={card.rookie} onChange={set('rookie')} />
            <Toggle label="Autograph" checked={card.auto} onChange={set('auto')} />
            <Toggle label="Patch" checked={card.patch} onChange={set('patch')} />
            <Toggle label="Refractor" checked={card.refractor} onChange={set('refractor')} />
          </div>
          <Field label="Serial number" hint='As printed, e.g. "23/99".' className="mt-3">
            <Input value={card.serial || ''} onChange={(e) => set('serial')(e.target.value)} placeholder="23/99" />
          </Field>
        </div>
      )}

      {has('grading') && (
        <div>
          <SectionTitle>Grading</SectionTitle>
          <Toggle label="Professionally graded (slabbed)" checked={card.graded} onChange={set('graded')} />
          {card.graded ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Grader">
                <Select value={card.grader} onChange={set('grader')} options={GRADERS} placeholder="Select…" ariaLabel="Grader" />
              </Field>
              <Field label="Grade">
                <Select value={card.grade} onChange={set('grade')} options={GRADES} placeholder="Select…" ariaLabel="Grade" />
              </Field>
              <Field label="Cert number" className="col-span-2">
                <Input value={card.certNumber || ''} onChange={(e) => set('certNumber')(e.target.value)} placeholder="From the slab label" inputMode="numeric" />
              </Field>
            </div>
          ) : (
            <Field label="Raw condition (your opinion)" className="mt-3">
              <Select value={card.rawCondition} onChange={set('rawCondition')} options={RAW_CONDITIONS} ariaLabel="Raw condition" />
            </Field>
          )}
        </div>
      )}

      <div>
        <SectionTitle>Notes</SectionTitle>
        <Input
          value={card.notes || ''}
          onChange={(e) => set('notes')(e.target.value)}
          placeholder="Anything worth remembering…"
          aria-label="Notes"
        />
      </div>
    </div>
  );
}

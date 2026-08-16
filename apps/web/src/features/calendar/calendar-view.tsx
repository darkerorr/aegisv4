"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { CalendarProvider, useCalendar, type CalendarEvent, PALETTE } from "./calendar-store";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SLOTS = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);

type View = "day" | "week" | "month" | "agenda";

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function CalendarBoard({ view, anchor, onNew, onOpen, available }: { view: View; anchor: Date; onNew: (date: Date) => void; onOpen: (event: CalendarEvent) => void; available: boolean }) {
  const { events } = useCalendar();
  const today = new Date();

  const eventsForDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const date = new Date(event.start);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const week = useMemo(() => {
    const start = startOfWeek(anchor);
    return WEEK.map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [anchor]);

  const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const dayEvents = (date: Date) => eventsForDay.get(keyOf(date)) ?? [];

  const renderEvent = (event: CalendarEvent) => (
    <button type="button" key={event.id} className="rb-cal__event" style={{ "--evt": event.color } as React.CSSProperties} onClick={() => onOpen(event)}>
      {event.allDay ? null : <time>{fmtTime(event.start)}</time>}
      <span>{event.title}</span>
    </button>
  );

  return (
    <AnimatePresence mode="wait">
      {view === "agenda" ? (
        <motion.div key="agenda" className="rb-cal__agenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {events.length === 0 ? (
            <div className="rb-empty"><CalendarDays size={30} /><strong>No events</strong><span>{available ? "Create an event to populate your agenda." : "Connect Google Workspace to sync a real calendar, or create local events here."}</span></div>
          ) : (
            [...events]
              .filter((event) => new Date(event.start).getTime() >= startOfWeek(anchor).getTime())
              .sort((a, b) => +new Date(a.start) - +new Date(b.start))
              .slice(0, 30)
              .map((event) => (
                <motion.button key={event.id} type="button" className="rb-cal__agenda-item" style={{ "--evt": event.color } as React.CSSProperties} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} onClick={() => onOpen(event)}>
                  <span className="rb-cal__agenda-date">
                    <b>{new Date(event.start).getDate()}</b>
                    <small>{MONTHS[new Date(event.start).getMonth()].slice(0, 3)}</small>
                  </span>
                  <span className="rb-cal__agenda-body">
                    <strong>{event.title}</strong>
                    <small>{event.allDay ? "All day" : `${fmtTime(event.start)} – ${fmtTime(event.end)}`}{event.location ? ` · ${event.location}` : ""}</small>
                  </span>
                  <span className="rb-cal__agenda-dot" />
                </motion.button>
              ))
          )}
        </motion.div>
      ) : view === "month" ? (
        <motion.div key="month" className="rb-cal__month" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="rb-cal__month-head">{WEEK.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="rb-cal__month-grid">
            {monthGrid(anchor).map((date) => (
              <div key={date.toISOString()} className={`rb-cal__month-cell ${sameDay(date, today) ? "is-today" : ""} ${date.getMonth() !== anchor.getMonth() ? "is-other" : ""}`} onClick={() => onNew(date)}>
                <span className="rb-cal__month-day">{date.getDate()}</span>
                <div className="rb-cal__month-events">
                  {dayEvents(date).slice(0, 3).map((event) => <span key={event.id} className="rb-cal__month-dot" style={{ background: event.color }} title={event.title} />)}
                  {dayEvents(date).length > 3 && <small>+{dayEvents(date).length - 3}</small>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : view === "day" ? (
        <motion.div key="day" className="rb-cal__time" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="rb-cal__time-head">
            <span className="rb-cal__time-today">{DAY_NAMES[anchor.getDay()]}</span>
            <span className="rb-cal__time-date">{MONTHS[anchor.getMonth()]} {anchor.getDate()}</span>
          </div>
          <div className="rb-cal__time-grid">
            {SLOTS.map((slot) => {
              const hour = parseInt(slot, 10);
              const events = dayEvents(anchor).filter((event) => !event.allDay && new Date(event.start).getHours() === hour);
              return (
                <div key={slot} className="rb-cal__time-row">
                  <span className="rb-cal__slot-label">{slot}</span>
                  <div className="rb-cal__slot" onClick={() => onNew(anchor)}>{events.map((event) => renderEvent(event))}</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div key="week" className="rb-cal__week" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="rb-cal__week-head">
            {week.map((date) => (
              <span key={date.toISOString()} className={sameDay(date, today) ? "is-today" : ""}>
                <b>{WEEK[(date.getDay() + 6) % 7]}</b>
                <i>{date.getDate()}</i>
              </span>
            ))}
          </div>
          <div className="rb-cal__week-grid">
            {week.map((date) => (
              <div key={date.toISOString()} className={`rb-cal__week-col ${sameDay(date, today) ? "is-today" : ""}`} onClick={() => onNew(date)}>
                {dayEvents(date).filter((event) => event.allDay).map((event) => renderEvent(event))}
                {dayEvents(date).filter((event) => !event.allDay).map((event) => renderEvent(event))}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EventModal({ initialDate, event, onClose, available }: { initialDate: Date; event: CalendarEvent | null; onClose: () => void; available: boolean }) {
  const { addEvent, updateEvent, removeEvent } = useCalendar();
  const [title, setTitle] = useState(event?.title ?? "");
  const [start, setStart] = useState(event ? toLocalDateTimeInput(event.start) : toLocalDateTimeInput(initialDate.toISOString()));
  const [end, setEnd] = useState(event ? toLocalDateTimeInput(event.end) : toLocalDateTimeInput(new Date(initialDate.getTime() + 60 * 60 * 1000).toISOString()));
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [color, setColor] = useState(event?.color ?? PALETTE[0]);
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");

  const submit = (action: "save" | "delete") => {
    if (action === "delete" && event) {
      removeEvent(event.id);
      onClose();
      return;
    }
    if (!title.trim()) return;
    const payload = { title: title.trim(), start: new Date(start).toISOString(), end: new Date(end).toISOString(), allDay, color, location: location.trim() || undefined, description: description.trim() || undefined };
    if (event) updateEvent({ ...event, ...payload });
    else addEvent(payload);
    onClose();
  };

  return (
    <div className="rb-modal" role="dialog" aria-modal="true" aria-label={event ? "Edit event" : "New event"}>
      <button type="button" className="rb-modal__scrim" aria-label="Close" onClick={onClose} />
      <motion.div className="rb-modal__card" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
        <header className="rb-modal__head">
          <div>
            <strong>{event ? "Edit event" : "New event"}</strong>
            {!available && <small>Local event — not synced to Google</small>}
          </div>
          <button type="button" className="v3-icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="rb-modal__body">
          <label className="rb-field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title" autoFocus /></label>
          <div className="rb-field rb-field--row">
            <label><span>Starts</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
            <label><span>Ends</span><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          </div>
          <label className="rb-field rb-field--check"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /><span>All-day event</span></label>
          <label className="rb-field"><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room, link…" /></label>
          <label className="rb-field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Notes…" rows={3} /></label>
          <div className="rb-field">
            <span>Color</span>
            <div className="rb-palette">{PALETTE.map((swatch) => <button key={swatch} type="button" className={color === swatch ? "is-active" : ""} style={{ background: swatch }} aria-label={`Color ${swatch}`} onClick={() => setColor(swatch)} />)}</div>
          </div>
        </div>
        <footer className="rb-modal__foot">
          {event && <button type="button" className="rb-btn rb-btn--danger" onClick={() => submit("delete")}><Trash2 size={14} />Delete</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="rb-btn rb-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="rb-btn rb-btn--primary" disabled={!title.trim()} onClick={() => submit("save")}>{event ? "Save changes" : "Create event"}</button>
        </footer>
      </motion.div>
    </div>
  );
}

function CalendarInner({ available }: { available: boolean }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [modal, setModal] = useState<{ date: Date; event: CalendarEvent | null } | null>(null);

  const label = useMemo(() => `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`, [anchor]);

  function shift(amount: number) {
    const copy = new Date(anchor);
    if (view === "month") copy.setMonth(copy.getMonth() + amount);
    else if (view === "day") copy.setDate(copy.getDate() + amount);
    else copy.setDate(copy.getDate() + amount * 7);
    setAnchor(copy);
  }

  return (
    <div className="rb-cal">
      <div className="rb-cal__toolbar">
        <div className="rb-cal__nav">
          <button type="button" className="rb-btn rb-btn--ghost rb-btn--sm" aria-label="Previous period" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <button type="button" className="rb-btn rb-btn--ghost rb-btn--sm" aria-label="Today" onClick={() => setAnchor(new Date())}><CalendarDays size={15} />Today</button>
          <button type="button" className="rb-btn rb-btn--ghost rb-btn--sm" aria-label="Next period" onClick={() => shift(1)}><ChevronRight size={16} /></button>
          <strong className="rb-cal__label">{label}</strong>
        </div>
        <div className="rb-cal__views">
          {(["day", "week", "month", "agenda"] as View[]).map((value) => (
            <button key={value} type="button" data-active={view === value} onClick={() => setView(value)}>{value[0].toUpperCase() + value.slice(1)}</button>
          ))}
        </div>
        <button type="button" className="rb-btn rb-btn--primary rb-btn--sm" onClick={() => setModal({ date: anchor, event: null })}><Plus size={15} />New event</button>
      </div>
      <div className="rb-cal__board">
        <CalendarBoard view={view} anchor={anchor} onNew={(date) => setModal({ date, event: null })} onOpen={(event) => setModal({ date: new Date(event.start), event })} available={available} />
      </div>
      {modal && <EventModal initialDate={modal.date} event={modal.event} onClose={() => setModal(null)} available={available} />}
    </div>
  );
}

export function CalendarView({ available }: { available: boolean }) {
  return <CalendarProvider><CalendarInner available={available} /></CalendarProvider>;
}

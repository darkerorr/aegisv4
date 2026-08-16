"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location?: string;
  description?: string;
}

const STORAGE_KEY = "aegis.calendar.events.v1";
const PALETTE = ["#ffffff", "#e8e8e8", "#d4d4d4", "#bdbdbd", "#a8a8a8", "#929292"];

function seedEvents(): CalendarEvent[] {
  const now = new Date();
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute);
    return date.toISOString();
  };
  return [
    { id: "seed-1", title: "Design review", start: at(0, 10, 30), end: at(0, 11, 30), allDay: false, color: PALETTE[0], location: "Conference room" },
    { id: "seed-2", title: "Deep work — Aegis rebuild", start: at(0, 14), end: at(0, 17), allDay: false, color: PALETTE[1], location: "Remote" },
    { id: "seed-3", title: "Standup", start: at(1, 9, 15), end: at(1, 9, 45), allDay: false, color: PALETTE[2], location: "Zoom" },
    { id: "seed-4", title: "Ship window", start: at(2, 12), end: at(2, 13), allDay: false, color: PALETTE[4], location: "Remote" },
  ];
}

interface CalendarStore {
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
}

const Context = createContext<CalendarStore | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEvents(JSON.parse(saved) as CalendarEvent[]);
      else setEvents(seedEvents());
    } catch {
      setEvents(seedEvents());
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {}
  }, [events]);

  const addEvent = useCallback((event: Omit<CalendarEvent, "id">) => {
    setEvents((current) => [...current, { ...event, id: crypto.randomUUID() }]);
  }, []);

  const updateEvent = useCallback((event: CalendarEvent) => {
    setEvents((current) => current.map((item) => (item.id === event.id ? event : item)));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ events, addEvent, updateEvent, removeEvent }), [events, addEvent, updateEvent, removeEvent]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCalendar(): CalendarStore {
  const value = useContext(Context);
  if (!value) throw new Error("useCalendar requires CalendarProvider");
  return value;
}

export { PALETTE };

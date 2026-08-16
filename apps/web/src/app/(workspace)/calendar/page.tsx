"use client";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LockKeyhole } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { integrationsApi } from "@/lib/api/integrations";
import { StatePanel } from "@/components/feedback/state-panel";
import { CalendarView } from "@/features/calendar/calendar-view";

export default function Calendar() {
  const query = useQuery({ queryKey: ["google-integration"], queryFn: () => integrationsApi.google(), staleTime: 30_000 });
  const available = query.data?.integration.services.calendar.available;

  return (
    <WorkspacePage
      title="Calendar"
      description="Day, week, month and agenda views over your schedule."
      icon={CalendarDays}
    >
      <div className="aegis-settings-stack">
        {query.isError ? <StatePanel state="error" title="Calendar unavailable" message="Unable to read calendar permissions." onRetry={() => query.refetch()} /> : (
          <div className="rb-cal-wrap">
            <CalendarView available={Boolean(available)} />
            {available && (
              <p className="rb-cal-note"><CalendarDays size={12} /> Google Calendar is connected — sync events from Connections to pull them in.</p>
            )}
          </div>
        )}
        {!available && !query.isError && (
          <aside className="permission-overlay"><LockKeyhole size={22} /><strong>Calendar permission required</strong><span>Connect Google Workspace from Connections to sync real events.</span></aside>
        )}
      </div>
    </WorkspacePage>
  );
}

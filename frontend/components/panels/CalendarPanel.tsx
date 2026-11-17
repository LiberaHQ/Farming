'use client';

import { useState } from 'react';
import { BIRTHDAYS, FESTIVALS, METEOR_SHOWER, NPCS, SEASONS, TIME_CONFIG, dayOfSeason, seasonOfDay, type NpcId, type Season } from '@farming/shared';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Panel } from './Panel';

const SEASON_ICON: Record<Season, string> = { spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️' };

/** What happens on a day of a season: birthdays, the festival, the meteor shower. */
function eventsOn(season: Season, day: number): Array<{ icon: string; text: string }> {
  const out: Array<{ icon: string; text: string }> = [];
  for (const id of Object.keys(BIRTHDAYS) as NpcId[]) {
    const b = BIRTHDAYS[id];
    if (b.season === season && b.day === day) out.push({ icon: '🎂', text: `${NPCS[id].name}'s birthday` });
  }
  const festival = Object.values(FESTIVALS).find((f) => f.season === season && f.day === day);
  if (festival) out.push({ icon: '🎪', text: festival.name });
  if (METEOR_SHOWER.season === season && METEOR_SHOWER.day === day) out.push({ icon: '🌠', text: 'Meteor shower (night)' });
  return out;
}

/** The calendar: this season's days with birthdays, festivals and sky events; browse the other seasons. */
export function CalendarPanel() {
  const cal = useGameEvent('calendar:state');
  const today = cal?.day ?? 1;
  const [season, setSeason] = useState<Season | null>(null);
  const shown = season ?? seasonOfDay(today);
  const isNow = shown === seasonOfDay(today);
  const todayInSeason = dayOfSeason(today);
  const days = Array.from({ length: TIME_CONFIG.daysPerSeason }, (_, i) => i + 1);
  const upcoming = days.filter((d) => isNow && d >= todayInSeason).flatMap((d) => eventsOn(shown, d).map((e) => ({ ...e, d })));
  return (
    <Panel title="Calendar" footer={<span className="hud-muted">Gifts count double on a villager's birthday. Festivals are on day 8 of every season.</span>}>
      <div className="tabs" role="tablist">
        {SEASONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={shown === s} className={`tab${shown === s ? ' active' : ''}`} onClick={() => setSeason(s)}>
            {SEASON_ICON[s]} {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((d) => {
          const events = eventsOn(shown, d);
          const current = isNow && d === todayInSeason;
          const past = isNow && d < todayInSeason;
          return (
            <div key={d} className={`calendar-day${current ? ' today' : ''}${past ? ' past' : ''}`}>
              <span className="calendar-num">{d}</span>
              {events.map((e) => (
                <span key={e.text} className="calendar-event" title={e.text}>
                  {e.icon} {e.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {isNow && (
        <p className="hud-muted" style={{ marginTop: 8 }}>
          {upcoming.length
            ? `Coming up: ${upcoming.map((e) => `${e.text} (${e.d === todayInSeason ? 'today' : `day ${e.d}`})`).join(' · ')}`
            : 'Nothing else this season — next season brings more.'}
        </p>
      )}
    </Panel>
  );
}
